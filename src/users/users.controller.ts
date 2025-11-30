import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Render,
    UseGuards,
    Request,
    Redirect,
    Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { UsersService } from './users.service';
import { SallaStoresService } from '../salla-stores/salla-stores.service';

@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
        private readonly sallaStoresService: SallaStoresService,
    ) { }

    @Get()
    @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
    @Render('users/index')
    async getUsers(@Request() req) {
        const users = await this.usersService.findAll();

        const errorParam = req.query.error;
        const successParam = req.query.success;

        let errorMessage: string | null = null;
        let successMessage: string | null = null;

        if (errorParam === 'user_not_found') {
            errorMessage = 'User not found.';
        } else if (successParam === 'user_created') {
            successMessage = 'User created successfully.';
        }

        return {
            title: 'User Management',
            user: req.user,
            users: users,
            errorMessage,
            successMessage,
        };
    }

    @Get('add')
    @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
    @Render('users/add')
    async getAddUser(@Request() req) {
        const stores = await this.sallaStoresService.findAll();
        const errorParam = req.query.error;
        const successParam = req.query.success;

        let errorMessage: string | null = null;
        let successMessage: string | null = null;

        if (errorParam === 'username_exists') {
            errorMessage = 'Username already exists. Please choose a different username.';
        } else if (errorParam === 'creation_failed') {
            errorMessage = 'Failed to create user. Please try again.';
        } else if (successParam === 'user_created') {
            successMessage = 'User created successfully.';
        }

        return {
            title: 'Add User',
            user: req.user,
            stores: stores,
            errorMessage,
            successMessage,
        };
    }

    @Post('add')
    @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
    async createUser(@Body() body: any, @Res() res) {
        try {
            const { username, password, assignedStoreId } = body;

            // Check if username already exists
            const existingUser = await this.usersService.findByUsername(username);
            if (existingUser) {
                return res.redirect('/users/add?error=username_exists');
            }

            await this.usersService.createUser({
                username,
                password,
                assignedStoreId: assignedStoreId || null,
            });

            return res.redirect('/users?success=user_created');
        } catch (error) {
            console.error('Error creating user:', error);
            return res.redirect('/users/add?error=creation_failed');
        }
    }

    @Get('edit/:id')
    @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
    @Render('users/edit')
    async getEditUser(@Param('id') id: string, @Request() req) {
        const userToEdit = await this.usersService.findById(id);
        const stores = await this.sallaStoresService.findAll();

        if (!userToEdit) {
            return { redirect: '/users?error=user_not_found' };
        }

        const errorParam = req.query.error;
        const successParam = req.query.success;

        let errorMessage: string | null = null;
        let successMessage: string | null = null;

        if (errorParam === 'username_exists') {
            errorMessage = 'Username already exists. Please choose a different username.';
        } else if (errorParam === 'update_failed') {
            errorMessage = 'Failed to update user. Please try again.';
        } else if (successParam === 'user_updated') {
            successMessage = 'User updated successfully.';
        }

        return {
            title: 'Edit User',
            user: req.user,
            userToEdit: userToEdit,
            stores: stores,
            errorMessage,
            successMessage,
        };
    }

    @Post('edit/:id')
    @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
    async updateUser(@Param('id') id: string, @Body() body: any, @Res() res) {
        try {
            const { username, password, assignedStoreId, isActive } = body;

            // Check if username already exists for another user
            if (username) {
                const existingUser = await this.usersService.findByUsername(username);
                if (existingUser && existingUser.id !== id) {
                    return res.redirect(`/users/edit/${id}?error=username_exists`);
                }
            }

            const updateData: any = {
                username,
                assignedStoreId: assignedStoreId || null,
                isActive: isActive === 'on',
            };

            // Only update password if provided
            if (password && password.trim() !== '') {
                updateData.password = password;
            }

            await this.usersService.updateUser(id, updateData);

            return res.redirect(`/users/edit/${id}?success=user_updated`);
        } catch (error) {
            console.error('Error updating user:', error);
            return res.redirect(`/users/edit/${id}?error=update_failed`);
        }
    }

    @Delete(':id')
    @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
    async deleteUser(@Param('id') id: string, @Res() res) {
        try {
            await this.usersService.deleteUser(id);
            return res.json({ success: true });
        } catch (error) {
            console.error('Error deleting user:', error);
            return res.status(500).json({ success: false, error: 'Failed to delete user' });
        }
    }

    @Post('toggle-status/:id')
    @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
    async toggleUserStatus(@Param('id') id: string, @Res() res) {
        try {
            // Check if user being toggled is a superadmin
            const userToToggle = await this.usersService.findById(id);
            if (!userToToggle) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }

            // Prevent deactivating superadmin users
            if (userToToggle.isSuperadmin) {
                return res.status(400).json({ success: false, error: 'Cannot deactivate superadmin users' });
            }

            await this.usersService.toggleUserStatus(id);
            return res.json({ success: true, message: 'User status updated successfully' });
        } catch (error) {
            console.error('Error toggling user status:', error);
            return res.status(500).json({ success: false, error: 'Failed to update user status' });
        }
    }

    @Get('change-password')
    @UseGuards(AuthGuard('jwt'))
    @Render('users/change-password')
    async getChangePassword(@Request() req) {
        const errorParam = req.query.error;
        const successParam = req.query.success;

        let errorMessage: string | null = null;
        let successMessage: string | null = null;

        if (errorParam === 'invalid_current_password') {
            errorMessage = 'Current password is incorrect.';
        } else if (errorParam === 'change_failed') {
            errorMessage = 'Failed to change password. Please try again.';
        } else if (errorParam === 'validation_failed') {
            errorMessage = 'Please fill in all required fields.';
        } else if (successParam === 'password_changed') {
            successMessage = 'Password changed successfully.';
        }

        return {
            title: 'Change Password',
            user: req.user,
            errorMessage,
            successMessage,
        };
    }

    @Post('change-password')
    @UseGuards(AuthGuard('jwt'))
    async changePassword(@Body() body: any, @Request() req, @Res() res) {
        try {
            const { currentPassword, newPassword, confirmPassword } = body;

            // Validation
            if (!currentPassword || !newPassword || !confirmPassword) {
                return res.redirect('/users/change-password?error=validation_failed');
            }

            if (newPassword !== confirmPassword) {
                return res.redirect('/users/change-password?error=validation_failed');
            }

            if (newPassword.length < 6) {
                return res.redirect('/users/change-password?error=validation_failed');
            }

            const result = await this.usersService.changePassword(
                req.user.id,
                currentPassword,
                newPassword
            );

            if (result.success) {
                return res.redirect('/users/change-password?success=password_changed');
            } else {
                if (result.message === 'Current password is incorrect.') {
                    return res.redirect('/users/change-password?error=invalid_current_password');
                } else {
                    return res.redirect('/users/change-password?error=change_failed');
                }
            }
        } catch (error) {
            console.error('Error changing password:', error);
            return res.redirect('/users/change-password?error=change_failed');
        }
    }
}

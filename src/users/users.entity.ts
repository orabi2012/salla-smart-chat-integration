import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BeforeInsert,
  BeforeUpdate,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SallaStore } from '../salla-stores/salla-stores.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isSuperadmin: boolean;

  @Column({ nullable: true })
  assignedStoreId: string;

  @ManyToOne(() => SallaStore, { nullable: true })
  @JoinColumn({ name: 'assignedStoreId' })
  assignedStore: SallaStore;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password) {
      // Check if password is already hashed (bcrypt hashes start with $2b$, $2a$, or $2y$)
      const isBcryptHash = /^\$2[abyxy]?\$/.test(this.password);

      if (!isBcryptHash) {
        const saltRounds = 10;
        this.password = await bcrypt.hash(this.password, saltRounds);
      }
    }
  }
}

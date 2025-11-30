import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SallaStore } from './salla-stores.entity';
import { SallaStoreProduct } from './salla-store-products.entity';
import { SallaStoreProductOption } from './salla-store-product-option.entity';
import { SallaStoreProductOptionsService } from './salla-store-product-options.service';
import { UbiqfyProduct } from '../ubiqfy-products/ubiqfy-product.entity';
import { SallaOAuthService } from './salla-oauth.service';
import { SallaStoresService } from './salla-stores.service';
import axios from 'axios';

export interface SallaCategory {
  id: number;
  name: string;
  slug: string;
  status: string;
  image?: string;
  parent_id?: number;
}

export interface SallaProduct {
  id: number;
  name: string;
  description?: string;
  price: number;
  sale_price?: number;
  salePrice?: number;
  sku: string;
  status: string;
  category_id: number;
  images?: Array<string | {
    url?: string;
    image_url?: string;
    image?: string | { url?: string };
    src?: string;
  }>;
  media?: Array<string | {
    url?: string;
    image_url?: string;
    image?: string | { url?: string };
    src?: string;
  }> | Record<string, any>;
  gallery?: Array<string | {
    url?: string;
    image_url?: string;
    image?: string | { url?: string };
    src?: string;
  }> | Record<string, any>;
}

@Injectable()
export class SallaIntegrationService {
  private readonly SALLA_BASE_URL = process.env.SALLA_BASE_URL || 'https://api.salla.dev/admin/v2';

  constructor(
    @InjectRepository(SallaStore)
    private readonly sallaStoreRepository: Repository<SallaStore>,
    @InjectRepository(SallaStoreProduct)
    private readonly storeProductRepository: Repository<SallaStoreProduct>,
    @InjectRepository(SallaStoreProductOption)
    private readonly storeProductOptionRepository: Repository<SallaStoreProductOption>,
    @InjectRepository(UbiqfyProduct)
    private readonly ubiqfyProductRepository: Repository<UbiqfyProduct>,
    private readonly sallaOAuthService: SallaOAuthService,
    private readonly sallaStoresService: SallaStoresService,
    private readonly optionsService: SallaStoreProductOptionsService,
  ) { }

  /**
   * Get the Salla client ID from environment variables
   */
  private getSallaClientId(): string {
    const clientId = process.env.SALLA_CLIENT_ID;
    if (!clientId) {
      throw new Error('SALLA_CLIENT_ID environment variable is required');
    }
    return clientId;
  }

  /**
   * Get the Salla client secret from environment variables
   */
  private getSallaClientSecret(): string {
    const clientSecret = process.env.SALLA_CLIENT_SECRET;
    if (!clientSecret) {
      throw new Error('SALLA_CLIENT_SECRET environment variable is required');
    }
    return clientSecret;
  }

  async syncProductsToSalla(storeId: string): Promise<{
    categories: any[];
    products: any[];
    errors: any[];
  }> {
    const store = await this.sallaStoreRepository.findOne({
      where: { id: storeId },
    });
    if (!store) {
      throw new HttpException('Store not found', HttpStatus.NOT_FOUND);
    }

    // Ensure we have a valid Salla access token (with automatic refresh)
    await this.ensureValidSallaToken(store);

    // Get store currency from Salla API (always fresh)
    const storeInfo = await this.getStoreInfo(store);
    console.log(
      `🏪 Store currency from Salla API: ${storeInfo.currency}, Country: ${storeInfo.country_code}`,
    );

    // Update database with latest currency if different
    if (store.salla_currency !== storeInfo.currency) {
      console.log(
        `💰 Updating stored currency: ${store.salla_currency} → ${storeInfo.currency}`,
      );
      await this.sallaStoreRepository.update(storeId, {
        salla_currency: storeInfo.currency,
      });
      store.salla_currency = storeInfo.currency; // Update local object
    }

    // Get all linked products for this store with their options
    const storeProducts = await this.storeProductRepository.find({
      where: { salla_store_id: storeId, is_active: true },
      relations: ['ubiqfyProduct', 'ubiqfyProduct.options', 'options'],
    });

    if (storeProducts.length === 0) {
      throw new HttpException(
        'No active products linked to this store',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Auto-migrate products that don't have options in the new system
    console.log('🔍 Checking for products that need options migration...');
    for (const storeProduct of storeProducts) {
      if (
        storeProduct.ubiqfyProduct.options &&
        storeProduct.ubiqfyProduct.options.length > 0
      ) {
        // Check if this product has options in the new system
        if (!storeProduct.options || storeProduct.options.length === 0) {
          console.log(
            `🔄 Auto-migrating options for ${storeProduct.ubiqfyProduct.product_code}...`,
          );
          try {
            const createdOptions =
              await this.optionsService.syncOptionsForStoreProduct(
                storeProduct.id,
                storeProduct.ubiqfyProduct.options,
                {
                  currency: storeInfo.currency,
                  conversionRate: store.currency_conversion_rate || 1.0,
                },
              );
            console.log(
              `✅ Auto-created ${createdOptions.length} options for ${storeProduct.ubiqfyProduct.product_code}`,
            );
          } catch (error) {
            console.warn(
              `⚠️  Failed to auto-migrate options for ${storeProduct.ubiqfyProduct.product_code}:`,
              error.message,
            );
          }
        }
      }
    }

    // Refresh store products to get the newly created options
    const refreshedStoreProducts = await this.storeProductRepository.find({
      where: { salla_store_id: storeId, is_active: true },
      relations: ['ubiqfyProduct', 'ubiqfyProduct.options', 'options'],
    });

    // Cache existing Salla products for efficient lookup
    const existingProductsMap: Map<string, any> = new Map();
    try {
      console.log(
        'Fetching existing Salla products for efficient update checking...',
      );
      const existingProductsResponse = await axios.get(
        `${this.SALLA_BASE_URL}/products`,
        {
          headers: {
            Authorization: `Bearer ${store.salla_access_token}`,
            Accept: 'application/json',
          },
          params: {
            per_page: 100, // Get more products per page
          },
        },
      );

      const existingProducts = existingProductsResponse.data.data || [];
      console.log(`Raw response has ${existingProducts.length} products`);

      existingProducts.forEach((product) => {
        if (product.sku) {
          existingProductsMap.set(product.sku, product);
          console.log(
            `Cached product: SKU=${product.sku}, Name=${product.name}, ID=${product.id}`,
          );
        }
      });
      console.log(
        `Successfully cached ${existingProductsMap.size} existing products by SKU`,
      );
    } catch (error) {
      console.warn(
        'Could not fetch existing products, will check individually:',
        error.message,
      );
    }

    const results: {
      categories: SallaCategory[];
      products: SallaProduct[];
      errors: Array<{
        type: string;
        productCode: string;
        optionName?: string;
        error: string;
      }>;
    } = {
      categories: [],
      products: [],
      errors: [],
    };

    // Cache for country subcategories to avoid duplicates
    // Key: "mainCategoryId-countryIso", Value: subcategory object
    const countrySubcategoriesCache = new Map<string, SallaCategory>();

    // Also create a persistent cache by querying existing Salla categories
    // This helps across multiple sync sessions
    let existingSallaCategories: SallaCategory[] = [];
    try {
      console.log(
        '🔍 Pre-loading existing Salla categories for efficient duplicate detection...',
      );
      existingSallaCategories = await this.getSallaCategories(storeId);
      console.log(
        `📋 Pre-loaded ${existingSallaCategories.length} existing Salla categories`,
      );

      // Pre-populate cache with existing subcategories
      existingSallaCategories.forEach((category) => {
        if (category.parent_id) {
          const cacheKey = `${category.parent_id}-${category.name}`;
          countrySubcategoriesCache.set(cacheKey, category);
          console.log(
            `📋 Pre-cached existing subcategory: ${cacheKey} (ID: ${category.id})`,
          );
        }
      });
      console.log(
        `📋 Pre-cached ${Array.from(countrySubcategoriesCache.keys()).length} existing subcategories`,
      );
    } catch (error) {
      console.warn(
        '⚠️  Could not pre-load existing categories, will check individually:',
        error.message,
      );
    }

    // Group products by Ubiqfy product (which will become categories)
    const productGroups = new Map<
      string,
      {
        ubiqfyProduct: UbiqfyProduct;
        storeProduct: SallaStoreProduct;
      }
    >();

    refreshedStoreProducts.forEach((storeProduct) => {
      const key = storeProduct.ubiqfyProduct.product_code;
      productGroups.set(key, {
        ubiqfyProduct: storeProduct.ubiqfyProduct,
        storeProduct: storeProduct,
      });
    });

    // Process each product group (create category + products)
    console.log(
      `\n🚀 Starting to process ${productGroups.size} product groups...`,
    );
    for (const [
      productCode,
      { ubiqfyProduct, storeProduct },
    ] of productGroups) {
      console.log(`\n🔄 Processing product group: ${productCode}`);
      console.log(`📦 Product name: ${ubiqfyProduct.name}`);
      console.log(`📷 Product logo_url: ${ubiqfyProduct.logo_url || 'NULL'}`);
      console.log(
        `⚙️  Has options: ${ubiqfyProduct.options?.length > 0 ? 'YES (' + ubiqfyProduct.options.length + ')' : 'NO'}`,
      );

      try {
        // First, check if this product has any valid options (fixed price only)
        let validOptions: any[] = [];
        let hasProductOptions = false;

        if (ubiqfyProduct.options && ubiqfyProduct.options.length > 0) {
          hasProductOptions = true;
          // Filter options to only include fixed-price ones
          validOptions = ubiqfyProduct.options.filter((option) => {
            if (option.min_value !== option.max_value) {
              console.log(
                `⏭️  Skipping option "${option.name}" - price range detected (min: ${option.min_value}, max: ${option.max_value}). Only fixed-price products are imported.`,
              );
              results.errors.push({
                type: 'product_skipped',
                productCode: ubiqfyProduct.product_code,
                optionName: option.name,
                error: `Price range detected (min: ${option.min_value}, max: ${option.max_value}). Only fixed-price products are imported.`,
              });
              return false;
            }
            return true;
          });
        }

        // Skip if no valid options found
        if (hasProductOptions && validOptions.length === 0) {
          console.log(
            `⏭️  Skipping product "${ubiqfyProduct.name}" - no valid fixed-price options found`,
          );
          continue;
        }

        console.log(
          `✅ Product "${ubiqfyProduct.name}" has ${hasProductOptions ? validOptions.length : 1} valid ${hasProductOptions ? 'options' : 'product'} to sync`,
        );

        // Now create categories only for products that have valid options/products to sync
        // 1. Create/Get Main Category (using product name)
        let mainCategoryId = storeProduct.salla_category_id;

        if (!mainCategoryId) {
          // Create/Get main category from Salla (no cache needed for main categories)
          const mainCategory = await this.createOrGetCategory(store, {
            name: ubiqfyProduct.name,
            image: ubiqfyProduct.logo_url,
            description: ubiqfyProduct.description,
          });

          results.categories.push(mainCategory);
          mainCategoryId = mainCategory.id.toString();

          // Store the main category ID in the database for future use
          await this.storeProductRepository.update(storeProduct.id, {
            salla_category_id: mainCategoryId,
          });

          console.log(
            `✅ Stored Salla main category ID ${mainCategoryId} for product ${ubiqfyProduct.name}`,
          );
        } else {
          console.log(
            `📂 Using stored main category ID ${mainCategoryId} for product ${ubiqfyProduct.name}`,
          );
        }

        // 2. Create/Get Country Subcategory if country_iso exists
        let categoryId = mainCategoryId; // Default to main category
        let countrySubcategoryId: string | null = null;

        if (
          ubiqfyProduct.country_iso &&
          ubiqfyProduct.country_iso.trim() !== ''
        ) {
          countrySubcategoryId = storeProduct.salla_country_subcategory_id;

          if (!countrySubcategoryId) {
            // Check cache first to avoid creating duplicate subcategories
            const cacheKey = `${mainCategoryId}-${ubiqfyProduct.country_iso}`;
            let countrySubcategory = countrySubcategoriesCache.get(cacheKey);

            if (!countrySubcategory) {
              // Not in cache, create/get from Salla
              console.log(
                `🏗️  Creating/retrieving country subcategory "${ubiqfyProduct.country_iso}" under main category ${mainCategoryId}`,
              );
              countrySubcategory = await this.createOrGetCategory(
                store,
                {
                  name: `${ubiqfyProduct.country_iso}`,
                  parent_id: parseInt(mainCategoryId),
                  description: `Products for ${ubiqfyProduct.country_iso}`,
                },
                countrySubcategoriesCache,
              );

              // Cache the subcategory for future use in this sync session
              countrySubcategoriesCache.set(cacheKey, countrySubcategory);

              // Only add to results if it's newly created (avoid duplicates in results)
              if (
                !results.categories.find((c) => c.id === countrySubcategory!.id)
              ) {
                results.categories.push(countrySubcategory);
              }

              console.log(
                `✅ Created/Retrieved country subcategory ${countrySubcategory.id} for ${ubiqfyProduct.country_iso} (cached for reuse)`,
              );
            } else {
              console.log(
                `📋 Using cached country subcategory ${countrySubcategory.id} for ${ubiqfyProduct.country_iso} (from cache or pre-loaded)`,
              );
            }

            countrySubcategoryId = countrySubcategory.id.toString();

            // Store the country subcategory ID in the database for future use
            await this.storeProductRepository.update(storeProduct.id, {
              salla_country_subcategory_id: countrySubcategoryId,
            });

            console.log(
              `✅ Stored Salla country subcategory ID ${countrySubcategoryId} for product ${ubiqfyProduct.name} (${ubiqfyProduct.country_iso})`,
            );
          } else {
            console.log(
              `📂 Using stored country subcategory ID ${countrySubcategoryId} for product ${ubiqfyProduct.name} (${ubiqfyProduct.country_iso})`,
            );
          }

          categoryId = countrySubcategoryId;
        }

        // 2. Create Products from Product Options
        if (hasProductOptions) {
          console.log(
            `🔀 Taking OPTIONS path - creating ${validOptions.length} products from valid options`,
          );

          // Get the stored options for this product
          const storedOptions = storeProduct.options || [];
          console.log(
            `🗃️  Found ${storedOptions.length} stored options for product ${ubiqfyProduct.product_code}:`,
          );
          storedOptions.forEach((opt) => {
            console.log(
              `    - Option ${opt.option_code}: custom_price=${opt.custom_price}, markup=${opt.markup_percentage}%`,
            );
          });

          const storedOptionsMap = new Map<string, SallaStoreProductOption>();
          storedOptions.forEach((opt) =>
            storedOptionsMap.set(opt.option_code, opt),
          );

          for (const option of validOptions) {
            try {
              const storedOption = storedOptionsMap.get(
                option.product_option_code,
              );

              console.log(
                `  ➤ Creating product for option: ${option.name} (fixed price: ${option.min_value})`,
              );
              console.log(
                `    🔍 Looking for stored option with code: ${option.product_option_code}`,
              );
              if (storedOption) {
                console.log(`    ✅ Found stored option:`, {
                  id: storedOption.id,
                  custom_price: storedOption.custom_price,
                  markup_percentage: storedOption.markup_percentage,
                  store_currency_price: storedOption.store_currency_price,
                });
              } else {
                console.log(
                  `    ❌ No stored option found for ${option.product_option_code}`,
                );
              }

              const sallaProduct = await this.createSallaProduct(
                store,
                {
                  categoryId: parseInt(categoryId),
                  option: option,
                  storedOption: storedOption, // Pass the stored option with pricing
                  storeProduct: storeProduct,
                  productLogo: ubiqfyProduct.logo_url,
                  existingProductsMap: existingProductsMap,
                },
                storeInfo.currency,
              );

              results.products.push(sallaProduct);

              // Update stored option with Salla product ID (NEW SYSTEM)
              if (storedOption) {
                await this.optionsService.markOptionAsSynced(
                  storedOption.id,
                  sallaProduct.id.toString(),
                );
                console.log(
                  `✅ Marked stored option ${storedOption.option_code} as synced with Salla product ${sallaProduct.id}`,
                );
              } else {
                console.warn(
                  `⚠️  No stored option found for ${option.product_option_code} - cannot mark as synced`,
                );
              }
            } catch (error) {
              console.error(
                `Error creating Salla product for option ${option.name}:`,
                error,
              );
              results.errors.push({
                type: 'product',
                productCode: productCode,
                optionName: option.name,
                error: error.message,
              });
            }
          }
        } else {
          console.log(
            `⚠️  Taking MAIN PRODUCT path - but this is not supported in the new system`,
          );
          console.log(
            `⚠️  All products must have options. Skipping product: ${ubiqfyProduct.name}`,
          );
          results.errors.push({
            type: 'product_skipped',
            productCode: productCode,
            error: `Product has no options - all products must have options in the new system`,
          });
          continue;
        }
      } catch (error) {
        console.error(`Error processing product group ${productCode}:`, error);
        results.errors.push({
          type: 'category',
          productCode: productCode,
          error: error.message,
        });
      }
    }

    // Summary logging
    const newMainCategories = results.categories.filter((c) => !c.parent_id);
    const newSubcategories = results.categories.filter((c) => c.parent_id);
    const totalSubcategoriesUsed = countrySubcategoriesCache.size;
    const reusedSubcategories =
      totalSubcategoriesUsed - newSubcategories.length;

    console.log(`\n📊 Sync Summary:`);
    console.log(
      `   📂 Main categories: ${newMainCategories.length} (newly created)`,
    );
    console.log(
      `   🌍 Country subcategories: ${newSubcategories.length} newly created, ${reusedSubcategories} reused from existing`,
    );
    console.log(`   🎮 Products created/updated: ${results.products.length}`);
    console.log(`   ❌ Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      results.errors.forEach((error) => {
        console.log(
          `   • ${error.type} - ${error.productCode}: ${error.error}`,
        );
      });
    }

    return results;
  }

  private async createOrGetCategory(
    store: SallaStore,
    categoryData: {
      name: string;
      image?: string;
      description?: string;
      parent_id?: number;
    },
    cache?: Map<string, SallaCategory>,
  ): Promise<SallaCategory> {
    const headers = {
      Authorization: `Bearer ${store.salla_access_token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // First, check the cache if provided (for subcategories)
    if (cache && categoryData.parent_id) {
      const cacheKey = `${categoryData.parent_id}-${categoryData.name}`;
      const cachedCategory = cache.get(cacheKey);
      if (cachedCategory) {
        console.log(
          `✅ Using cached category: ID ${cachedCategory.id}, Name: "${cachedCategory.name}", Parent: ${cachedCategory.parent_id || 'none'}`,
        );
        return cachedCategory;
      }
    }

    // Second, check if category already exists via API
    try {
      console.log(
        `🔍 Searching for existing category: "${categoryData.name}" with parent_id: ${categoryData.parent_id || 'none'}`,
      );
      const existingResponse = await axios.get(
        `${this.SALLA_BASE_URL}/categories`,
        {
          headers,
          params: { name: categoryData.name },
        },
      );

      if (existingResponse.data.data && existingResponse.data.data.length > 0) {
        console.log(
          `📋 Found ${existingResponse.data.data.length} categories with name "${categoryData.name}"`,
        );
        // For subcategories, also check parent_id matches
        const existing = existingResponse.data.data.find(
          (cat) =>
            cat.name === categoryData.name &&
            (categoryData.parent_id
              ? cat.parent_id === categoryData.parent_id
              : !cat.parent_id),
        );
        if (existing) {
          console.log(
            `✅ Using existing category: ID ${existing.id}, Name: "${existing.name}", Parent: ${existing.parent_id || 'none'}`,
          );

          // Cache it for future use if cache is provided
          if (cache && categoryData.parent_id) {
            const cacheKey = `${categoryData.parent_id}-${categoryData.name}`;
            cache.set(cacheKey, existing);
            console.log(
              `📋 Cached existing category for future use: ${cacheKey}`,
            );
          }

          return existing;
        } else {
          console.log(
            `⚠️  Found categories with same name but different parent_id. Looking for parent_id: ${categoryData.parent_id}`,
          );
        }
      } else {
        console.log(
          `📭 No existing categories found with name "${categoryData.name}"`,
        );
      }
    } catch (error) {
      console.log('Error checking existing categories:', error.message);
    }

    // Create new category - NOTE: Salla requires images to be uploaded via their media API
    // External URLs are not supported, so temporarily creating without images
    const categoryPayload: any = {
      name: categoryData.name,
      description: categoryData.description || categoryData.name,
      // TODO: Implement proper image upload via /admin/v2/media endpoint
      // ...(categoryData.image && { image: categoryData.image })
    };

    // Add parent_id if provided (for subcategories)
    if (categoryData.parent_id) {
      categoryPayload.parent_id = categoryData.parent_id;
    }

    try {
      console.log(
        'Creating Salla category (without image for now):',
        categoryPayload,
      );
      if (categoryData.image) {
        console.warn(
          '⚠️  Image URL provided but skipped - Salla requires images to be uploaded via media API first',
        );
        console.warn('   Image URL that would be used:', categoryData.image);
      }
      const response = await axios.post(
        `${this.SALLA_BASE_URL}/categories`,
        categoryPayload,
        {
          headers,
          timeout: 15000,
        },
      );
      console.log('✅ Salla category created successfully:', {
        id: response.data.data.id,
        name: response.data.data.name,
        status: response.data.data.status,
      });

      // Cache the newly created category if cache is provided and it's a subcategory
      if (cache && categoryData.parent_id) {
        const cacheKey = `${categoryData.parent_id}-${categoryData.name}`;
        cache.set(cacheKey, response.data.data);
        console.log(
          `📋 Cached newly created category for future use: ${cacheKey}`,
        );
      }

      return response.data.data;
    } catch (error) {
      console.error('Salla category creation error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        headers: error.config?.headers,
      });

      if (error.response?.status === 401) {
        throw new Error(
          'Authentication failed: Invalid or expired Salla access token',
        );
      } else if (error.response?.status === 403) {
        throw new Error(
          'Permission denied: Insufficient privileges to create categories',
        );
      } else if (error.response?.status === 422) {
        // Better handling of validation errors
        const errorData = error.response?.data;
        let validationDetails = 'Unknown validation error';

        if (errorData?.error?.fields) {
          validationDetails = JSON.stringify(errorData.error.fields, null, 2);
        } else if (errorData?.errors) {
          validationDetails = JSON.stringify(errorData.errors, null, 2);
        } else if (errorData?.error?.message) {
          validationDetails = errorData.error.message;
        }

        console.error('Detailed validation errors:', validationDetails);
        throw new Error(`Validation error: ${validationDetails}`);
      } else {
        const errorMessage =
          error.response?.data?.message || error.message || 'Unknown error';
        throw new Error(`Failed to create category: ${errorMessage}`);
      }
    }
  }

  private async createSallaProduct(
    store: SallaStore,
    productData: {
      categoryId: number;
      option: any;
      storedOption?: SallaStoreProductOption;
      storeProduct: SallaStoreProduct;
      productLogo?: string;
      existingProductsMap?: Map<string, any>;
    },
    storeCurrency: string,
  ): Promise<SallaProduct> {
    const {
      categoryId,
      option,
      storedOption,
      storeProduct,
      productLogo,
      existingProductsMap,
    } = productData;

    const headers = {
      Authorization: `Bearer ${store.salla_access_token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Validate that min_value equals max_value (no price range) - safety check
    if (option.min_value !== option.max_value) {
      throw new Error(
        `Option "${option.name}" has price range (min: ${option.min_value}, max: ${option.max_value}). Only fixed-price products are supported.`,
      );
    }

    // Calculate final price using min_value instead of min_face_value
    let finalPrice = option.min_value || option.max_value || 0;

    // Calculate cost price using min_wholesale_value
    let costPrice =
      option.min_wholesale_value || option.max_wholesale_value || 0;

    // Use stored option pricing (NEW SYSTEM ONLY)
    if (storedOption) {
      // Get final price using the options service
      finalPrice = this.optionsService.getFinalPrice(storedOption);
      console.log(
        `💰 Using pricing from stored option: Base=${storedOption.custom_price || storedOption.store_currency_price}, Markup=${storedOption.markup_percentage}%, Final=${finalPrice}`,
      );

      // If custom_price is set, it's already in store currency - no conversion needed
      if (storedOption.custom_price) {
        console.log(
          `✅ Custom price used: ${storedOption.custom_price} (already in ${storeCurrency}) - skipping currency conversion`,
        );
        // Keep finalPrice as is, no conversion needed
      } else {
        // Only convert currency if using store_currency_price (fallback)
        if (storeCurrency !== store.ubiqfy_currency) {
          const conversionRate = store.currency_conversion_rate || 1.0;
          finalPrice = finalPrice * conversionRate;
          console.log(
            `💱 Currency conversion for store_currency_price: ${(finalPrice / conversionRate).toFixed(2)} → ${finalPrice.toFixed(2)} ${storeCurrency} (rate: ${conversionRate})`,
          );
        }
      }
    } else {
      throw new Error(
        `No stored option found for option code: ${option.product_option_code}. Options must be synced before creating Salla products.`,
      );
    }

    // Convert cost price currency using manual conversion rate from database
    if (storeCurrency !== store.ubiqfy_currency) {
      const conversionRate = store.currency_conversion_rate || 1.0;
      costPrice = costPrice * conversionRate;
    }

    // Create product name with country code if available
    const productName = storeProduct.ubiqfyProduct.country_iso
      ? `${option.name} (${storeProduct.ubiqfyProduct.country_iso})`
      : option.name;

    // Create product without image first, then attach image separately
    const productPayload = {
      name: productName,
      description: option.description || `${option.name} - Digital Gift Card`,
      price: finalPrice,
      cost_price: costPrice,
      sku: `${store.sku_prefix || 'UBQ'}-${option.product_option_code}`, // Add store's custom prefix
      categories: [categoryId], // Use categories array instead of category_id for proper linking
      product_type: 'codes',
    };

    if (productLogo) {
      console.log(
        `📷 Will attach image after product creation: ${productLogo}`,
      );
    } else {
      console.log(`📷 DEBUG: No productLogo provided for this product option`);
    }

    console.log(
      `� DEBUG: Final productPayload:`,
      JSON.stringify(productPayload, null, 2),
    );
    console.log(
      `�🔗 Product will be linked to category ID: ${categoryId} using categories array`,
    );

    // Check if product already exists by SKU using cache or API call
    let existingProduct: any = null;

    if (
      existingProductsMap &&
      existingProductsMap.has(option.product_option_code)
    ) {
      existingProduct = existingProductsMap.get(option.product_option_code);
      console.log('✅ Found existing product in cache:', {
        id: existingProduct.id,
        name: existingProduct.name,
        sku: existingProduct.sku,
      });
    } else {
      // Fallback to API call if cache is not available
      try {
        const prefixedSku = `${store.sku_prefix || 'UBQ'}-${option.product_option_code}`;
        console.log(
          'Checking if product exists with SKU:',
          prefixedSku,
        );
        const existingProductsResponse = await axios.get(
          `${this.SALLA_BASE_URL}/products`,
          {
            headers,
            params: { sku: prefixedSku },
          },
        );

        const existingProducts = existingProductsResponse.data.data || [];
        existingProduct =
          existingProducts.find((p) => p.sku === prefixedSku) ||
          null;
      } catch (error) {
        console.log(
          'Note: Could not check existing products, proceeding with creation',
        );
      }
    }

    if (existingProduct) {
      console.log('📝 Updating existing product:', existingProduct.name);
      console.log('Current product categories:', existingProduct.categories);

      // For existing products, only update pricing to preserve manual customizations
      const updatePayload = {
        price: finalPrice,
        cost_price: costPrice,
      };

      console.log('📝 Updating only pricing data:', updatePayload);

      try {
        const updateResponse = await axios.put(
          `${this.SALLA_BASE_URL}/products/${existingProduct.id}`,
          updatePayload,
          { headers },
        );
        console.log('✅ Product pricing updated successfully');
        console.log('Preserved product info:', {
          name: updateResponse.data.data.name,
          description: updateResponse.data.data.description,
          categories: updateResponse.data.data.categories || [],
        });

        // Attach image after successful update
        if (productLogo) {
          await this.attachImageToProduct(
            store,
            updateResponse.data.data.id,
            productLogo,
          );
        }

        return updateResponse.data.data;
      } catch (error) {
        console.error(
          'Failed to update product, will try to create new one:',
          error.message,
        );
        // If update fails, continue to creation
      }
    }

    try {
      console.log('Creating new Salla product:', productPayload);
      const response = await axios.post(
        `${this.SALLA_BASE_URL}/products`,
        productPayload,
        { headers },
      );
      console.log('✅ New product created successfully');
      console.log('Created product category info:', {
        category_id: response.data.data.category_id || 'Not set',
        categories: response.data.data.categories || [],
      });

      // Attach image after successful creation
      if (productLogo) {
        await this.attachImageToProduct(
          store,
          response.data.data.id,
          productLogo,
        );
      }

      return response.data.data;
    } catch (error) {
      console.error(
        'Salla product creation error:',
        error.response?.data || error.message,
      );

      // Better error handling for products too
      if (error.response?.status === 422) {
        const errorData = error.response?.data;
        let validationDetails = 'Unknown validation error';

        if (errorData?.error?.fields) {
          validationDetails = JSON.stringify(errorData.error.fields, null, 2);
        } else if (errorData?.errors) {
          validationDetails = JSON.stringify(errorData.errors, null, 2);
        }

        console.error('Product validation errors:', validationDetails);
        throw new Error(`Product validation error: ${validationDetails}`);
      }

      throw new Error(
        `Failed to create product: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async getSallaCategories(storeId: string): Promise<SallaCategory[]> {
    const store = await this.sallaStoreRepository.findOne({
      where: { id: storeId },
    });
    if (!store) {
      throw new HttpException('Store not found', HttpStatus.NOT_FOUND);
    }

    const headers = {
      Authorization: `Bearer ${store.salla_access_token}`,
      Accept: 'application/json',
    };

    try {
      const allCategories: SallaCategory[] = [];
      let page = 1;
      let hasMore = true;

      console.log('🔍 Fetching all Salla categories with pagination...');

      while (hasMore) {
        const response = await axios.get(`${this.SALLA_BASE_URL}/categories`, {
          headers,
          params: {
            page: page,
            per_page: 100, // Get maximum categories per page
          },
        });

        const categories = response.data.data || [];
        const pagination = response.data.pagination || {};

        console.log(`📄 Page ${page}: Found ${categories.length} categories`);
        allCategories.push(...categories);

        // Check if there are more pages
        hasMore = pagination.current_page < pagination.last_page;
        page++;

        // Safety check to prevent infinite loops
        if (page > 50) {
          console.warn(
            '⚠️  Reached maximum page limit (50) for categories fetch',
          );
          break;
        }
      }

      console.log(`📋 Total categories fetched: ${allCategories.length}`);

      // Log subcategories for debugging
      const subcategories = allCategories.filter((cat) => cat.parent_id);
      console.log(`📂 Found ${subcategories.length} subcategories:`);
      subcategories.forEach((sub) => {
        console.log(
          `   • ${sub.name} (ID: ${sub.id}, Parent: ${sub.parent_id})`,
        );
      });

      return allCategories;
    } catch (error) {
      console.error(
        'Error fetching Salla categories:',
        error.response?.data || error.message,
      );
      throw new HttpException(
        'Failed to fetch Salla categories',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getSallaProducts(storeId: string): Promise<SallaProduct[]> {
    const store = await this.sallaStoreRepository.findOne({
      where: { id: storeId },
    });
    if (!store) {
      throw new HttpException('Store not found', HttpStatus.NOT_FOUND);
    }

    const headers = {
      Authorization: `Bearer ${store.salla_access_token}`,
      Accept: 'application/json',
    };

    try {
      const response = await axios.get(`${this.SALLA_BASE_URL}/products`, {
        headers,
      });
      return response.data.data || [];
    } catch (error) {
      console.error(
        'Error fetching Salla products:',
        error.response?.data || error.message,
      );
      throw new HttpException(
        'Failed to fetch Salla products',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Test Salla API connection and token validity
  async testSallaConnection(storeId: string): Promise<{
    connected: boolean;
    storeInfo?: any;
    error?: string;
    refreshAttempted?: boolean;
  }> {
    try {
      const store = await this.sallaStoreRepository.findOne({
        where: { id: storeId },
      });
      if (!store) {
        return { connected: false, error: 'Store not found' };
      }

      if (!store.salla_access_token) {
        return { connected: false, error: 'No Salla access token configured' };
      }

      const headers = {
        Authorization: `Bearer ${store.salla_access_token}`,
        Accept: 'application/json',
      };

      console.log(
        'Testing Salla connection with token:',
        store.salla_access_token.substring(0, 20) + '...',
      );

      const response = await axios.get(`${this.SALLA_BASE_URL}/store/info`, {
        headers,
        timeout: 10000,
      });

      return {
        connected: true,
        storeInfo: response.data.data,
      };
    } catch (error) {
      console.error('Salla connection test failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });

      // Get store again for the error handling block
      const store = await this.sallaStoreRepository.findOne({
        where: { id: storeId },
      });

      // If token is invalid (401), try to refresh it automatically
      if (error.response?.status === 401 && store?.salla_refresh_token) {
        console.log('🔄 Token invalid, attempting automatic refresh...');
        try {
          await this.ensureValidSallaToken(store);

          // Retry the connection test with refreshed token
          const newHeaders = {
            Authorization: `Bearer ${store.salla_access_token}`,
            Accept: 'application/json',
          };

          const retryResponse = await axios.get(`${this.SALLA_BASE_URL}/store/info`, {
            headers: newHeaders,
            timeout: 10000,
          });

          return {
            connected: true,
            storeInfo: retryResponse.data.data,
            refreshAttempted: true,
          };
        } catch (refreshError) {
          console.error('❌ Automatic token refresh failed:', refreshError.message);
          return {
            connected: false,
            error: `Token invalid and refresh failed: ${refreshError.message}. Manual re-authorization required.`,
            refreshAttempted: true,
          };
        }
      }

      return {
        connected: false,
        error: `Connection failed: ${error.response?.status} ${error.response?.statusText || error.message}`,
      };
    }
  }

  // Helper method to verify product-category link
  private async verifyProductCategoryLink(
    productId: number,
    expectedCategoryId: number,
    headers: any,
  ): Promise<void> {
    try {
      console.log(
        `🔍 Verifying product ${productId} is linked to category ${expectedCategoryId}...`,
      );
      const productResponse = await axios.get(
        `${this.SALLA_BASE_URL}/products/${productId}`,
        { headers },
      );
      const product = productResponse.data.data;

      // Check if the product has categories
      if (product.categories && product.categories.length > 0) {
        const linkedCategories = product.categories.map((cat) => cat.id);
        const isLinked = linkedCategories.includes(expectedCategoryId);

        if (isLinked) {
          console.log(
            `✅ Product correctly linked to category ${expectedCategoryId}`,
          );
        } else {
          console.log(
            `⚠️  Product NOT linked to expected category. Linked to: [${linkedCategories.join(', ')}]`,
          );
          // Try to manually link the product to the category
          await this.linkProductToCategory(
            productId,
            expectedCategoryId,
            headers,
          );
        }
      } else {
        console.log(`⚠️  Product has no category links. Attempting to link...`);
        await this.linkProductToCategory(
          productId,
          expectedCategoryId,
          headers,
        );
      }
    } catch (error) {
      console.warn('Could not verify product-category link:', error.message);
    }
  }

  // Helper method to manually link product to category
  private async linkProductToCategory(
    productId: number,
    categoryId: number,
    headers: any,
  ): Promise<void> {
    try {
      console.log(
        `🔗 Attempting to manually link product ${productId} to category ${categoryId}...`,
      );

      // Use categories array instead of category_id for proper linking
      const updateResponse = await axios.put(
        `${this.SALLA_BASE_URL}/products/${productId}`,
        {
          categories: [categoryId],
        },
        { headers },
      );

      console.log(`✅ Successfully linked product to category`);
    } catch (error) {
      console.error(
        `❌ Failed to manually link product to category:`,
        error.response?.data || error.message,
      );
    }
  }

  // Helper method to attach image to product using Salla's image API
  private async attachImageToProduct(
    store: SallaStore,
    productId: number,
    imageUrl: string,
  ): Promise<void> {
    try {
      console.log(
        `🖼️  Attempting to attach image to product ${productId}: ${imageUrl}`,
      );

      const headers = {
        Authorization: `Bearer ${store.salla_access_token}`,
        Accept: 'application/json',
      };

      // Check if the product already has any images
      try {
        console.log(`🔍 Checking existing images for product ${productId}...`);
        const productResponse = await axios.get(
          `${this.SALLA_BASE_URL}/products/${productId}`,
          { headers },
        );
        const existingImages = productResponse.data.data?.images || [];

        console.log(`📊 Image check results for product ${productId}:`, {
          totalImages: existingImages.length,
          imageDetails: existingImages.map(img => ({
            id: img.id,
            url: img.url || img.image?.original?.url,
            alt: img.alt
          }))
        });

        if (existingImages.length > 0) {
          console.log(
            `📷 Product ${productId} already has ${existingImages.length} image(s), skipping image attachment`,
          );
          console.log(
            `Existing images:`,
            existingImages
              .map((img) => img.url || img.image?.original?.url)
              .filter(Boolean),
          );
          return;
        }

        console.log(
          `📷 Product ${productId} has no images, proceeding with attachment`,
        );
      } catch (error) {
        console.log(
          `⚠️  Could not check existing images, proceeding with attachment:`,
          error.message,
        );
      }

      // Method 1: Try downloading and uploading the image file
      try {
        console.log(`📥 Downloading image from URL: ${imageUrl}`);

        // Download the image with SSL verification disabled for problematic certificates
        const imageResponse = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 10000, // 10 second timeout
          httpsAgent: new (require('https').Agent)({
            rejectUnauthorized: false // Skip SSL certificate validation
          })
        }); const imageBuffer = Buffer.from(imageResponse.data);
        const contentType = imageResponse.headers['content-type'] || 'image/png';

        // Determine file extension from content type
        let fileExtension = '.png';
        if (contentType.includes('jpeg') || contentType.includes('jpg')) {
          fileExtension = '.jpg';
        } else if (contentType.includes('gif')) {
          fileExtension = '.gif';
        } else if (contentType.includes('webp')) {
          fileExtension = '.webp';
        }

        console.log(`📦 Downloaded image: ${imageBuffer.length} bytes, type: ${contentType}`);

        // Upload using multipart form data with actual file
        const FormData = require('form-data');
        const formData = new FormData();

        // Try the correct field name for Salla API
        formData.append('photo', imageBuffer, {
          filename: `product_${productId}${fileExtension}`,
          contentType: contentType,
        }); const formHeaders = {
          ...headers,
          ...formData.getHeaders(),
        };

        const uploadResponse = await axios.post(
          `${this.SALLA_BASE_URL}/products/${productId}/images`,
          formData,
          {
            headers: formHeaders,
            timeout: 30000, // 30 second timeout for upload
          },
        );

        console.log(`✅ Image uploaded successfully to product ${productId}`);
        console.log(`Image details:`, {
          id: uploadResponse.data.data?.id,
          url: uploadResponse.data.data?.image?.original?.url,
        });

        return;

      } catch (downloadError) {
        console.warn(`⚠️  Method 1 failed (file upload): ${downloadError.message}`);
        console.log(`🔄 Trying Method 2 (URL reference)...`);
      }

      // Method 2: Fallback to URL reference method
      try {
        const FormData = require('form-data');
        const formData = new FormData();

        // Try the correct field name based on the error message
        formData.append('photo', imageUrl); const formHeaders = {
          ...headers,
          ...formData.getHeaders(),
        };

        const urlResponse = await axios.post(
          `${this.SALLA_BASE_URL}/products/${productId}/images`,
          formData,
          {
            headers: formHeaders,
          },
        );

        console.log(`✅ Image URL attached successfully to product ${productId}`);
        console.log(`Image details:`, {
          id: urlResponse.data.data?.id,
          url: urlResponse.data.data?.image?.original?.url,
        });

        return;

      } catch (urlError) {
        console.warn(`⚠️  Method 2 failed (URL reference): ${urlError.message}`);
      }

      // Method 3: Try using direct JSON payload
      try {
        const jsonPayload = {
          photo: imageUrl,
        };

        const jsonResponse = await axios.post(
          `${this.SALLA_BASE_URL}/products/${productId}/images`,
          jsonPayload,
          { headers },
        );

        console.log(`✅ Image JSON payload attached successfully to product ${productId}`);
        console.log(`Image details:`, {
          id: jsonResponse.data.data?.id,
          url: jsonResponse.data.data?.image?.original?.url,
        });

      } catch (jsonError) {
        console.error(`❌ All methods failed to attach image to product ${productId}`);
        console.error(`Last error (JSON method):`, jsonError.response?.data || jsonError.message);
      }

    } catch (error) {
      console.error(
        `❌ Failed to attach image to product ${productId}:`,
        error.response?.data || error.message,
      );

      // Don't throw error - just log it so product creation still succeeds
      if (error.response?.status === 422) {
        console.error(
          `Image validation error:`,
          JSON.stringify(error.response.data, null, 2),
        );
      } else if (error.response?.status === 404) {
        console.error(`Product not found or image endpoint unavailable`);
      } else if (error.code === 'ECONNABORTED') {
        console.error(`Image download/upload timeout`);
      }
    }
  }

  /**
   * Ensures the Salla access token is valid, refreshing it if necessary
   */
  private async ensureValidSallaToken(store: SallaStore): Promise<void> {
    // Check if we have a token at all
    if (!store.salla_access_token) {
      throw new HttpException(
        'Salla access token not configured for this store',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if we have a refresh token for automatic refresh
    if (!store.salla_refresh_token) {
      console.log(
        '⚠️  No refresh token available - manual token refresh required',
      );
    }

    // Check if token is expired or will expire soon (refresh proactively)
    const now = new Date();
    const tokenExpiry = store.salla_token_expiry;
    const shouldRefresh =
      tokenExpiry &&
      (now > tokenExpiry ||
        tokenExpiry.getTime() - now.getTime() < 5 * 60 * 1000); // Refresh if expired or expires in 5 minutes

    if (shouldRefresh && store.salla_refresh_token) {
      console.log('🔄 Token expired or expiring soon, attempting refresh...');
      try {
        const refreshResult = await this.sallaOAuthService.refreshToken(
          store.salla_refresh_token,
          this.getSallaClientId(),
          this.getSallaClientSecret(),
        );

        // Calculate new expiry date
        const newExpiry = new Date();
        newExpiry.setSeconds(newExpiry.getSeconds() + refreshResult.expires_in);

        // Update the store with new tokens
        await this.sallaStoresService.update(store.id, {
          salla_access_token: refreshResult.access_token,
          salla_refresh_token: refreshResult.refresh_token,
          salla_token_expiry: newExpiry,
        });

        // Update the local store object
        store.salla_access_token = refreshResult.access_token;
        store.salla_refresh_token = refreshResult.refresh_token;
        store.salla_token_expiry = newExpiry;

        console.log('✅ Token refreshed successfully');
      } catch (error) {
        console.error('❌ Token refresh failed:', error.message);
        throw new HttpException(
          'Failed to refresh Salla access token. Please re-authenticate.',
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    // Test the token by making a simple API call
    try {
      const testHeaders = {
        Authorization: `Bearer ${store.salla_access_token}`,
        Accept: 'application/json',
      };

      console.log('🔍 Validating Salla token...');
      await axios.get(`${this.SALLA_BASE_URL}/store/info`, {
        headers: testHeaders,
        timeout: 10000,
      });
      console.log('✅ Salla token is valid');
    } catch (error) {
      console.error(
        '❌ Salla token validation failed:',
        error.response?.status,
        error.response?.data,
      );

      if (error.response?.status === 401) {
        // Try to refresh token one more time if we have a refresh token
        if (store.salla_refresh_token && !shouldRefresh) {
          console.log('🔄 Token invalid, attempting refresh...');
          try {
            const refreshResult = await this.sallaOAuthService.refreshToken(
              store.salla_refresh_token,
              this.getSallaClientId(),
              this.getSallaClientSecret(),
            );

            // Calculate new expiry date
            const newExpiry = new Date();
            newExpiry.setSeconds(
              newExpiry.getSeconds() + refreshResult.expires_in,
            );

            // Update the store with new tokens
            await this.sallaStoresService.update(store.id, {
              salla_access_token: refreshResult.access_token,
              salla_refresh_token: refreshResult.refresh_token,
              salla_token_expiry: newExpiry,
            });

            // Update the local store object
            store.salla_access_token = refreshResult.access_token;
            store.salla_refresh_token = refreshResult.refresh_token;
            store.salla_token_expiry = newExpiry;

            console.log(
              '✅ Token refreshed successfully after validation failure',
            );

            // Test the new token
            const newHeaders = {
              Authorization: `Bearer ${store.salla_access_token}`,
              Accept: 'application/json',
            };

            await axios.get(`${this.SALLA_BASE_URL}/store/info`, {
              headers: newHeaders,
              timeout: 10000,
            });
            console.log('✅ New token validated successfully');
          } catch (refreshError) {
            console.error(
              '❌ Token refresh after validation failure also failed:',
              refreshError.message,
            );
            throw new HttpException(
              'Salla access token is invalid and refresh failed. Please re-authenticate.',
              HttpStatus.UNAUTHORIZED,
            );
          }
        } else {
          throw new HttpException(
            'Salla access token is invalid or expired. Please re-authenticate.',
            HttpStatus.UNAUTHORIZED,
          );
        }
      } else if (error.response?.status === 403) {
        throw new HttpException(
          'Insufficient permissions for Salla API. Please check token scopes.',
          HttpStatus.FORBIDDEN,
        );
      } else {
        throw new HttpException(
          `Failed to connect to Salla API: ${error.message}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
    }
  }

  /**
   * Get store information including currency
   */
  private async getStoreInfo(
    store: SallaStore,
  ): Promise<{ currency: string; country_code: string }> {
    const headers = {
      Authorization: `Bearer ${store.salla_access_token}`,
      'Content-Type': 'application/json',
    };

    try {
      console.log('🏪 Fetching store information and currency...');
      const response = await axios.get(`${this.SALLA_BASE_URL}/store/info`, {
        headers,
      });

      const storeInfo = response.data.data;
      console.log(`💰 Store Currency: ${storeInfo.currency}`);
      console.log(`🌍 Store Country: ${storeInfo.country_code}`);

      return {
        currency: storeInfo.currency,
        country_code: storeInfo.country_code,
      };
    } catch (error) {
      console.warn(
        '⚠️  Could not fetch store info, using defaults:',
        error.message,
      );
      return {
        currency: 'SAR', // Default to Saudi Riyal
        country_code: 'SA',
      };
    }
  }

  /**
   * Verify sync status by checking if options still exist in Salla
   */
  async verifySyncStatus(storeId: string): Promise<{
    total_checked: number;
    still_synced: number;
    no_longer_synced: number;
    verification_errors: Array<{
      product_code: string;
      option_code: string;
      error: string;
    }>;
    updated_options: Array<{
      product_code: string;
      option_code: string;
      status: string;
      reason: string;
    }>;
  }> {
    console.log(`🔍 Verifying sync status for store: ${storeId}`);

    // Get store
    const store = await this.sallaStoreRepository.findOne({
      where: { id: storeId },
    });
    if (!store) {
      throw new Error(`Store with ID ${storeId} not found`);
    }

    // Get all options that have been synced to Salla
    const syncedOptions =
      await this.optionsService.findSyncedOptionsForStore(storeId);

    console.log(`📊 Found ${syncedOptions.length} options marked as synced`);

    const results = {
      total_checked: syncedOptions.length,
      still_synced: 0,
      no_longer_synced: 0,
      verification_errors: [] as Array<{
        product_code: string;
        option_code: string;
        error: string;
      }>,
      updated_options: [] as Array<{
        product_code: string;
        option_code: string;
        status: string;
        reason: string;
      }>,
    };

    // Check each option in Salla
    for (const syncedOption of syncedOptions) {
      try {
        if (!syncedOption.salla_product_id) {
          continue;
        }

        // Try to fetch the product from Salla
        const response = await fetch(
          `${process.env.SALLA_BASE_URL || 'https://api.salla.dev/admin/v2'}/products/${syncedOption.salla_product_id}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${store.salla_access_token}`,
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
          },
        );

        if (response.status === 404) {
          // Product no longer exists in Salla
          console.log(
            `❌ Product no longer exists in Salla: ${syncedOption.storeProduct.ubiqfyProduct.product_code} (Option ${syncedOption.option_code})`,
          );

          // Clear the Salla product ID to mark as not synced
          syncedOption.salla_product_id = null;
          await this.optionsService.save(syncedOption);

          results.no_longer_synced++;
          results.updated_options.push({
            product_code: syncedOption.storeProduct.ubiqfyProduct.product_code,
            option_code: syncedOption.option_code,
            status: 'marked_as_not_synced',
            reason: 'not_found_in_salla',
          });
        } else if (response.ok) {
          // Product still exists
          results.still_synced++;
          console.log(
            `✅ Product verified in Salla: ${syncedOption.storeProduct.ubiqfyProduct.product_code} (Option ${syncedOption.option_code})`,
          );
        } else {
          // Other error (rate limit, auth issue, etc.)
          console.warn(
            `⚠️  Could not verify product ${syncedOption.storeProduct.ubiqfyProduct.product_code} (Option ${syncedOption.option_code}): ${response.status}`,
          );
          results.verification_errors.push({
            product_code: syncedOption.storeProduct.ubiqfyProduct.product_code,
            option_code: syncedOption.option_code,
            error: `HTTP ${response.status}`,
          });
        }
      } catch (error) {
        console.error(
          `❌ Error verifying option ${syncedOption.storeProduct?.ubiqfyProduct?.product_code} (${syncedOption.option_code}):`,
          error.message,
        );
        results.verification_errors.push({
          product_code:
            syncedOption.storeProduct?.ubiqfyProduct?.product_code || 'unknown',
          option_code: syncedOption.option_code,
          error: error.message,
        });
      }

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      `✅ Verification complete: ${results.still_synced} still synced, ${results.no_longer_synced} removed, ${results.verification_errors.length} errors`,
    );

    return results;
  }

  /**
   * Force re-authorization by clearing tokens and generating new auth URL
   * Use this when both access token and refresh token are invalid
   */
  async forceReauthorization(storeId: string): Promise<{
    authUrl: string;
    message: string;
  }> {
    try {
      const store = await this.sallaStoreRepository.findOne({
        where: { id: storeId },
      });
      if (!store) {
        throw new Error('Store not found');
      }

      // Clear the invalid tokens
      await this.sallaStoresService.update(store.id, {
        salla_access_token: undefined,
        salla_refresh_token: undefined,
        salla_token_expiry: undefined,
      });

      // Generate new authorization URL using environment credentials
      const authUrl = this.sallaOAuthService.generateAuthUrl(
        this.getSallaClientId(),
        `store-${store.id}`
      );

      console.log(`🔄 Force re-authorization initiated for store: ${store.salla_store_name}`);
      console.log(`🔗 Authorization URL: ${authUrl}`);

      return {
        authUrl,
        message: `Tokens cleared. Please visit the authorization URL to re-authorize the store: ${store.salla_store_name}`
      };
    } catch (error) {
      console.error('❌ Force re-authorization failed:', error.message);
      throw new Error(`Failed to initiate re-authorization: ${error.message}`);
    }
  }
}

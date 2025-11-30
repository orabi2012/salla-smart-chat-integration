import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SallaStoreProductOption } from './salla-store-product-option.entity';
import { SallaStoreProduct } from './salla-store-products.entity';

@Injectable()
export class SallaStoreProductOptionsService {
  constructor(
    @InjectRepository(SallaStoreProductOption)
    private readonly optionRepository: Repository<SallaStoreProductOption>,
    @InjectRepository(SallaStoreProduct)
    private readonly storeProductRepository: Repository<SallaStoreProduct>,
  ) { }

  /**
   * Create or update options for a store product based on Ubiqfy product options
   * @param storeProductId - ID of the store product
   * @param ubiqfyOptions - Array of Ubiqfy product options
   * @param storeInfo - Store currency information (required for proper price conversion)
   */
  async syncOptionsForStoreProduct(
    storeProductId: string,
    ubiqfyOptions: any[],
    storeInfo: { currency: string; conversionRate: number },
  ): Promise<SallaStoreProductOption[]> {
    // Get existing options
    const existingOptions = await this.optionRepository.find({
      where: { salla_store_product_id: storeProductId },
    });

    const existingOptionsMap = new Map<string, SallaStoreProductOption>();
    existingOptions.forEach((option) => {
      existingOptionsMap.set(option.option_code, option);
    });

    const syncedOptions: SallaStoreProductOption[] = [];

    // Process each Ubiqfy option
    for (const ubiqfyOption of ubiqfyOptions) {
      // Debug: Log what data we're getting
      console.log(`🔍 DEBUG: Processing option ${ubiqfyOption.product_option_code}:`);
      console.log(`   - min_face_value: ${ubiqfyOption.min_face_value} (type: ${typeof ubiqfyOption.min_face_value})`);
      console.log(`   - product_currency_code: ${ubiqfyOption.product_currency_code} (type: ${typeof ubiqfyOption.product_currency_code})`);
      console.log(`   - Full option object keys:`, Object.keys(ubiqfyOption));

      // Skip price range options (only process fixed-price options)
      if (ubiqfyOption.min_value !== ubiqfyOption.max_value) {
        continue;
      }

      const retailPriceUSD =
        ubiqfyOption.min_value || ubiqfyOption.max_value || 0;

      // Calculate wholesale price from min_wholesale_value if available, otherwise calculate from min_value and discount
      let wholesalePriceUSD = 0;
      if (ubiqfyOption.min_wholesale_value) {
        // Data from database entity - use min_wholesale_value directly
        wholesalePriceUSD = ubiqfyOption.min_wholesale_value;
        console.log(`📊 DEBUG: Using min_wholesale_value from DB: ${wholesalePriceUSD}`);
      } else if (
        ubiqfyOption.MinMaxRangeValue &&
        ubiqfyOption.MinMaxRangeValue.MinWholesaleValue
      ) {
        // Data from API response - use nested structure
        wholesalePriceUSD = ubiqfyOption.MinMaxRangeValue.MinWholesaleValue;
        console.log(`📊 DEBUG: Using MinWholesaleValue from API: ${wholesalePriceUSD}`);
      } else {
        // Get the parent product to access discount value
        const storeProduct = await this.storeProductRepository.findOne({
          where: { id: storeProductId },
          relations: ['ubiqfyProduct'],
        });
        const discount = storeProduct?.ubiqfyProduct?.discount || 0;
        // Calculate: MinValue - (MinValue × Discount)
        wholesalePriceUSD = retailPriceUSD - retailPriceUSD * discount;
        console.log(`📊 DEBUG: Calculated wholesale price from discount: ${wholesalePriceUSD} (discount: ${discount})`);
      }

      let storeCurrencyPrice = wholesalePriceUSD; // This will be the wholesale price in store currency - NO ROUNDING
      let retailPriceInStoreCurrency = retailPriceUSD; // This will be the retail price in store currency

      // Always convert to store currency using the provided conversion rate
      if (storeInfo.conversionRate !== 1) {
        storeCurrencyPrice = wholesalePriceUSD * storeInfo.conversionRate; // Keep exact conversion, no rounding
        retailPriceInStoreCurrency =
          retailPriceUSD * storeInfo.conversionRate;

        console.log(
          `💱 Converting prices for ${ubiqfyOption.product_option_code}: USD ${wholesalePriceUSD} → ${storeInfo.currency} ${storeCurrencyPrice.toFixed(4)} (rate: ${storeInfo.conversionRate})`
        );
      } else {
        console.log(
          `💰 No conversion needed for ${ubiqfyOption.product_option_code}: ${wholesalePriceUSD} USD = ${storeCurrencyPrice} ${storeInfo.currency}`
        );
      }

      const existingOption = existingOptionsMap.get(
        ubiqfyOption.product_option_code,
      );

      if (existingOption) {
        // Update existing option - keep user's custom prices but sync source data from Ubiqfy
        existingOption.option_name = ubiqfyOption.name;
        existingOption.original_price_usd = wholesalePriceUSD; // Store wholesale price (cost price)
        existingOption.retail_price_usd = retailPriceUSD; // Store retail price (sale price)
        existingOption.wholesale_price_usd = wholesalePriceUSD; // Duplicate for compatibility
        existingOption.store_currency_price = storeCurrencyPrice; // wholesale price in store currency - no rounding
        existingOption.updated_at = new Date();
        // Sync MinFaceValue and ProductCurrencyCode from Ubiqfy source
        existingOption.min_face_value = ubiqfyOption.min_face_value;
        existingOption.product_currency_code = ubiqfyOption.product_currency_code;

        console.log(`💾 DEBUG: Saving existing option ${ubiqfyOption.product_option_code}:`);
        console.log(`   - Setting min_face_value: ${ubiqfyOption.min_face_value} → ${existingOption.min_face_value}`);
        console.log(`   - Setting product_currency_code: ${ubiqfyOption.product_currency_code} → ${existingOption.product_currency_code}`);
        console.log(`   - Setting original_price_usd (wholesale): ${wholesalePriceUSD} → ${existingOption.original_price_usd}`);
        console.log(`   - Setting retail_price_usd: ${retailPriceUSD} → ${existingOption.retail_price_usd}`);
        console.log(`💱 DEBUG: Currency from ubiqfyOption.product_currency_code = '${ubiqfyOption.product_currency_code}'`);

        const updatedOption = await this.optionRepository.save(existingOption);

        console.log(`✅ DEBUG: Saved existing option with:`);
        console.log(`   - min_face_value: ${updatedOption.min_face_value}`);
        console.log(`   - product_currency_code: ${updatedOption.product_currency_code}`);

        syncedOptions.push(updatedOption);
      } else {
        // Create new option
        // Get the UbiqfyProduct to access discount value for initial markup percentage
        const storeProduct = await this.storeProductRepository.findOne({
          where: { id: storeProductId },
          relations: ['ubiqfyProduct'],
        });

        const initialMarkupPercentage = storeProduct?.ubiqfyProduct?.discount
          ? storeProduct.ubiqfyProduct.discount * 100
          : 0;

        const newOption = this.optionRepository.create({
          salla_store_product_id: storeProductId,
          option_code: ubiqfyOption.product_option_code,
          option_name: ubiqfyOption.name,
          original_price_usd: wholesalePriceUSD, // Store wholesale price (cost price)
          retail_price_usd: retailPriceUSD, // Store retail price (sale price)
          wholesale_price_usd: wholesalePriceUSD, // Duplicate for compatibility
          store_currency_price: storeCurrencyPrice, // wholesale price in store currency
          custom_price: retailPriceInStoreCurrency, // Initialize with retail price in store currency
          markup_percentage: initialMarkupPercentage, // Initialize with discount * 100
          is_synced_to_salla: false,
          // Sync MinFaceValue and ProductCurrencyCode from Ubiqfy source
          min_face_value: ubiqfyOption.min_face_value,
          product_currency_code: ubiqfyOption.product_currency_code,
        });

        console.log(`💾 DEBUG: Creating new option ${ubiqfyOption.product_option_code}:`);
        console.log(`   - Setting min_face_value: ${ubiqfyOption.min_face_value} → ${newOption.min_face_value}`);
        console.log(`   - Setting product_currency_code: ${ubiqfyOption.product_currency_code} → ${newOption.product_currency_code}`);
        console.log(`   - Setting original_price_usd (wholesale): ${wholesalePriceUSD} → ${newOption.original_price_usd}`);
        console.log(`   - Setting retail_price_usd: ${retailPriceUSD} → ${newOption.retail_price_usd}`);
        console.log(`💱 DEBUG: Currency from ubiqfyOption.product_currency_code = '${ubiqfyOption.product_currency_code}'`);

        const savedOption = await this.optionRepository.save(newOption);

        console.log(`✅ DEBUG: Created new option with:`);
        console.log(`   - min_face_value: ${savedOption.min_face_value}`);
        console.log(`   - product_currency_code: ${savedOption.product_currency_code}`);

        syncedOptions.push(savedOption);
      }
    }

    return syncedOptions;
  }

  /**
   * Get all options for a store product
   */
  async getOptionsForStoreProduct(
    storeProductId: string,
  ): Promise<SallaStoreProductOption[]> {
    return this.optionRepository.find({
      where: { salla_store_product_id: storeProductId },
      order: { option_name: 'ASC' },
    });
  }

  /**
   * Get the final price for Salla - custom_price is already calculated and stored
   */
  getFinalPrice(option: SallaStoreProductOption): number {
    // Return the custom_price directly - it's already calculated and ready for Salla
    return option.custom_price || option.store_currency_price;
  }

  /**
   * Update pricing for a specific option
   */
  async updateOptionPricing(
    optionId: string,
    customPrice?: number,
    markupPercentage?: number,
  ): Promise<SallaStoreProductOption> {
    const option = await this.optionRepository.findOne({
      where: { id: optionId },
    });
    if (!option) {
      throw new Error('Option not found');
    }

    if (customPrice !== undefined) {
      option.custom_price = customPrice;
    }

    if (markupPercentage !== undefined) {
      option.markup_percentage = markupPercentage;
    }

    option.updated_at = new Date();
    option.is_synced_to_salla = false; // Mark as needing re-sync

    return this.optionRepository.save(option);
  }

  /**
   * Mark option as synced to Salla
   */
  async markOptionAsSynced(
    optionId: string,
    sallaProductId: string,
  ): Promise<void> {
    await this.optionRepository.update(optionId, {
      salla_product_id: sallaProductId,
      is_synced_to_salla: true,
      last_synced_at: new Date(),
    });
  }

  /**
   * Get options that need syncing (not synced or updated after last sync)
   */
  async getOptionsNeedingSync(
    storeProductId: string,
  ): Promise<SallaStoreProductOption[]> {
    return this.optionRepository.find({
      where: {
        salla_store_product_id: storeProductId,
        is_synced_to_salla: false,
      },
      order: { option_name: 'ASC' },
    });
  }

  /**
   * Delete options that are no longer in Ubiqfy product
   */
  async cleanupRemovedOptions(
    storeProductId: string,
    currentOptionCodes: string[],
  ): Promise<void> {
    const existingOptions = await this.optionRepository.find({
      where: { salla_store_product_id: storeProductId },
    });

    const optionsToRemove = existingOptions.filter(
      (option) => !currentOptionCodes.includes(option.option_code),
    );

    if (optionsToRemove.length > 0) {
      await this.optionRepository.remove(optionsToRemove);
    }
  }

  /**
   * Find all synced options for a store
   */
  async findSyncedOptionsForStore(
    storeId: string,
  ): Promise<SallaStoreProductOption[]> {
    return await this.optionRepository
      .createQueryBuilder('option')
      .leftJoinAndSelect('option.storeProduct', 'storeProduct')
      .leftJoinAndSelect('storeProduct.ubiqfyProduct', 'ubiqfyProduct')
      .where('storeProduct.salla_store_id = :storeId', { storeId })
      .andWhere('option.salla_product_id IS NOT NULL')
      .getMany();
  }

  /**
   * Update custom price and automatically calculate markup percentage
   * This maintains the two-way binding between custom price and markup percentage
   */
  async updateCustomPriceAndCalculateMarkup(
    optionId: string,
    customPrice: number,
  ): Promise<SallaStoreProductOption> {
    const option = await this.optionRepository.findOne({
      where: { id: optionId },
    });
    if (!option) {
      throw new Error('Option not found');
    }

    // Update custom price
    option.custom_price = customPrice;

    // Calculate markup percentage based on the difference between custom price and store currency price
    const basePriceForCalculation = option.store_currency_price;
    if (basePriceForCalculation > 0) {
      // Calculate markup: ((custom_price - base_price) / base_price) * 100
      const markupDecimal =
        (customPrice - basePriceForCalculation) / basePriceForCalculation;
      option.markup_percentage = Math.round(markupDecimal * 100 * 100) / 100; // Round to 2 decimal places
    } else {
      option.markup_percentage = 0;
    }

    option.updated_at = new Date();
    option.is_synced_to_salla = false; // Mark as needing re-sync

    return this.optionRepository.save(option);
  }

  /**
   * Update markup percentage and automatically calculate custom price
   * This maintains the two-way binding between markup percentage and custom price
   */
  async updateMarkupAndCalculateCustomPrice(
    optionId: string,
    markupPercentage: number,
  ): Promise<SallaStoreProductOption> {
    const option = await this.optionRepository.findOne({
      where: { id: optionId },
    });
    if (!option) {
      throw new Error('Option not found');
    }

    // Update markup percentage
    option.markup_percentage = markupPercentage;

    // Calculate custom price based on markup percentage
    const basePriceForCalculation = option.store_currency_price;
    option.custom_price =
      basePriceForCalculation * (1 + markupPercentage / 100);

    // Round to 2 decimal places
    option.custom_price = Math.round(option.custom_price * 100) / 100;

    option.updated_at = new Date();
    option.is_synced_to_salla = false; // Mark as needing re-sync

    return this.optionRepository.save(option);
  }

  /**
   * Save an option entity
   */
  async save(
    option: SallaStoreProductOption,
  ): Promise<SallaStoreProductOption> {
    return await this.optionRepository.save(option);
  }

  /**
   * Create or update an option with custom pricing from frontend
   * @param storeProductId - ID of the store product
   * @param ubiqfyOption - Ubiqfy product option data
   * @param customPrice - Optional custom price override
   * @param markupPercentage - Optional markup percentage
   * @param isActive - Whether the option is active
   * @param frontendPricingData - Pricing data from frontend
   * @param storeInfo - Store currency information (optional for backward compatibility)
   */
  async createOrUpdateOptionWithCustomPricing(
    storeProductId: string,
    ubiqfyOption: any,
    customPrice?: number,
    markupPercentage?: number,
    isActive?: boolean,
    frontendPricingData?: {
      minValue?: number;
      maxValue?: number;
      minFaceValue?: number;
      productCurrencyCode?: string;
      minWholesaleValue?: number;
      maxWholesaleValue?: number;
    },
    storeInfo?: { currency: string; conversionRate: number },
  ): Promise<SallaStoreProductOption> {
    // Check if option already exists
    let option = await this.optionRepository.findOne({
      where: {
        salla_store_product_id: storeProductId,
        option_code: ubiqfyOption.product_option_code,
      },
    });

    if (option) {
      // Update existing option
      if (customPrice !== undefined && customPrice !== null) {
        option.custom_price = customPrice;
      }
      if (markupPercentage !== undefined && markupPercentage !== null) {
        option.markup_percentage = markupPercentage;
      }

      // Always update store_currency_price when storeInfo is available, even for existing options
      if (storeInfo) {
        // Calculate current wholesale price from USD fields
        const wholesalePriceUSD = option.wholesale_price_usd || option.original_price_usd || 0;

        // Convert to store currency
        let storeCurrencyPrice = wholesalePriceUSD;
        if (storeInfo.conversionRate !== 1) {
          storeCurrencyPrice = wholesalePriceUSD * storeInfo.conversionRate;
          console.log(
            `💱 Updating store_currency_price for existing option ${option.option_code}: USD ${wholesalePriceUSD} → ${storeInfo.currency} ${storeCurrencyPrice.toFixed(4)} (rate: ${storeInfo.conversionRate})`
          );
        }
        option.store_currency_price = storeCurrencyPrice;
      }

      // Sync MinFaceValue and ProductCurrencyCode - use frontend data if available, otherwise use ubiqfyOption
      option.min_face_value = frontendPricingData?.minFaceValue || ubiqfyOption.min_face_value;
      option.product_currency_code = frontendPricingData?.productCurrencyCode || ubiqfyOption.product_currency_code;
      option.updated_at = new Date();
      option.is_synced_to_salla = false; // Mark as needing re-sync
    } else {
      // Create new option
      // Use frontend pricing data if available, otherwise fall back to ubiqfyOption data
      const retailPriceUSD = frontendPricingData?.minValue ||
        ubiqfyOption.min_value ||
        ubiqfyOption.max_value || 0;

      // Calculate wholesale price - prioritize frontend data, then ubiqfyOption data
      let wholesalePriceUSD = frontendPricingData?.minWholesaleValue || 0;

      if (!wholesalePriceUSD && ubiqfyOption.MinMaxRangeValue && ubiqfyOption.MinMaxRangeValue.MinWholesaleValue) {
        wholesalePriceUSD = ubiqfyOption.MinMaxRangeValue.MinWholesaleValue;
      }

      // If still no wholesale price, use retail price as fallback (this should not normally happen)
      if (!wholesalePriceUSD) {
        wholesalePriceUSD = retailPriceUSD;
      }

      console.log(`💰 Creating option with pricing: retail=${retailPriceUSD}, wholesale=${wholesalePriceUSD}, minFace=${frontendPricingData?.minFaceValue || ubiqfyOption.min_face_value}`);
      console.log(`💱 Currency debugging: frontendCurrency=${frontendPricingData?.productCurrencyCode}, ubiqfyCurrency=${ubiqfyOption.product_currency_code}, finalCurrency=${frontendPricingData?.productCurrencyCode || ubiqfyOption.product_currency_code}`);

      // Convert to store currency if storeInfo is provided
      let storeCurrencyPrice = wholesalePriceUSD;
      if (storeInfo && storeInfo.conversionRate !== 1) {
        storeCurrencyPrice = wholesalePriceUSD * storeInfo.conversionRate;
        console.log(
          `💱 Converting wholesale price for ${ubiqfyOption.product_option_code}: USD ${wholesalePriceUSD} → ${storeInfo.currency} ${storeCurrencyPrice.toFixed(4)} (rate: ${storeInfo.conversionRate})`
        );
      } else if (!storeInfo) {
        console.warn(`⚠️  No storeInfo provided for ${ubiqfyOption.product_option_code}, keeping USD price as store_currency_price`);
      }

      const initialMarkupPercentage =
        markupPercentage !== undefined ? markupPercentage : 0;

      option = this.optionRepository.create({
        salla_store_product_id: storeProductId,
        option_code: ubiqfyOption.product_option_code,
        option_name: ubiqfyOption.name,
        original_price_usd: wholesalePriceUSD, // Store wholesale price (cost price)
        retail_price_usd: retailPriceUSD, // Store retail price (sale price)
        wholesale_price_usd: wholesalePriceUSD, // Duplicate for compatibility
        store_currency_price: storeCurrencyPrice, // Wholesale price converted to store currency
        custom_price: customPrice || null,
        markup_percentage: initialMarkupPercentage,
        // Use frontend data if available, otherwise use ubiqfyOption data
        min_face_value: frontendPricingData?.minFaceValue || ubiqfyOption.min_face_value,
        product_currency_code: frontendPricingData?.productCurrencyCode || ubiqfyOption.product_currency_code,
        salla_product_id: null,
        is_synced_to_salla: false,
        last_synced_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    const savedOption = await this.optionRepository.save(option);

    return savedOption;
  }
}

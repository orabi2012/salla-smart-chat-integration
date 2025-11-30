import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UbiqfyProduct } from './ubiqfy-product.entity';
import { UbiqfyProductOption } from './ubiqfy-product-option.entity';

@Injectable()
export class UbiqfyProductsService {
  constructor(
    @InjectRepository(UbiqfyProduct)
    private readonly ubiqfyProductRepo: Repository<UbiqfyProduct>,
    @InjectRepository(UbiqfyProductOption)
    private readonly ubiqfyProductOptionRepo: Repository<UbiqfyProductOption>,
  ) { }

  async saveProductsFromApiResponse(
    productsData: any[],
  ): Promise<UbiqfyProduct[]> {
    const savedProducts: UbiqfyProduct[] = [];

    for (const productData of productsData) {
      // Check if product already exists
      let existingProduct = await this.ubiqfyProductRepo.findOne({
        where: { product_code: productData.ProductCode },
        relations: ['options'],
      });

      if (existingProduct) {
        // Update existing product
        existingProduct = await this.updateProductFromApiData(
          existingProduct,
          productData,
        );
      } else {
        // Create new product
        existingProduct = await this.createProductFromApiData(productData);
      }

      savedProducts.push(existingProduct);
    }

    return savedProducts;
  }

  private async createProductFromApiData(
    productData: any,
  ): Promise<UbiqfyProduct> {
    const product = this.ubiqfyProductRepo.create({
      name: productData.Name,
      provider_code: productData.ProviderCode,
      product_code: productData.ProductCode,
      description: productData.Description,
      product_description: productData.ProductDescription,
      logo_url: productData.ProductLogo,
      brand_logo_url: productData.BrandLogo,
      terms_url: productData.TermsUrl,
      privacy_url: productData.PrivacyUrl,
      reedem_url: productData.ReedemUrl,
      notes: productData.Notes,
      reedem_desc: productData.ReedemDesc,
      receipt_message: productData.ReceiptMessage,
      next_method_call: productData.NextMethodCall || 'DoTransaction',
      is_voucher: productData.IsVoucher || false,
      is_transaction_cancelabled: productData.IsTransationCancelabled || false,
      country_iso: productData.CountryIso,
      currency_code: productData.CurrencyCode,
      product_currency_code: productData.ProductCurrencyCode,
      discount: productData.Discount || 0,
      product_url: productData.ProductUrl,
      terms_conditions: productData.TermsConditions,
      reference_length: productData.ReferenceLength,
      group_code: productData.GroupCode,
      vfp_code: productData.VFPCode,
      vgp_code: productData.VGPCode,
      general_data_message: productData.GeneralDataMessage,
      dealer_code: productData.DealerCode,
      dealer_type: productData.DealerType,
      group_key: productData.GroupKey,
      image_code: productData.ImageCode,
      pin_expiry_time: productData.PinExpiryTime,
      mandatory_fields: productData.MandatoryFields,
      visible_fields: productData.VisibleFields,
    });

    const savedProduct = await this.ubiqfyProductRepo.save(product);

    // Save product options
    if (
      productData.ProductOptionsList &&
      productData.ProductOptionsList.length > 0
    ) {
      await this.saveProductOptions(
        savedProduct.id,
        productData.ProductOptionsList,
        productData.ProductCurrencyCode,
      );
    }

    const productWithOptions = await this.ubiqfyProductRepo.findOne({
      where: { id: savedProduct.id },
      relations: ['options'],
    });

    if (!productWithOptions) {
      throw new Error(
        `Product with id ${savedProduct.id} not found after creation`,
      );
    }

    return productWithOptions;
  }

  private async updateProductFromApiData(
    existingProduct: UbiqfyProduct,
    productData: any,
  ): Promise<UbiqfyProduct> {
    // Update product fields
    existingProduct.name = productData.Name;
    existingProduct.provider_code = productData.ProviderCode;
    existingProduct.description = productData.Description;
    existingProduct.product_description = productData.ProductDescription;
    existingProduct.logo_url = productData.ProductLogo;
    existingProduct.brand_logo_url = productData.BrandLogo;
    existingProduct.terms_url = productData.TermsUrl;
    existingProduct.privacy_url = productData.PrivacyUrl;
    existingProduct.reedem_url = productData.ReedemUrl;
    existingProduct.notes = productData.Notes;
    existingProduct.reedem_desc = productData.ReedemDesc;
    existingProduct.receipt_message = productData.ReceiptMessage;
    existingProduct.next_method_call =
      productData.NextMethodCall || 'DoTransaction';
    existingProduct.is_voucher = productData.IsVoucher || false;
    existingProduct.is_transaction_cancelabled =
      productData.IsTransationCancelabled || false;
    existingProduct.country_iso = productData.CountryIso;
    existingProduct.currency_code = productData.CurrencyCode;
    existingProduct.product_currency_code = productData.ProductCurrencyCode;
    existingProduct.discount = productData.Discount || 0;
    existingProduct.product_url = productData.ProductUrl;
    existingProduct.terms_conditions = productData.TermsConditions;
    existingProduct.reference_length = productData.ReferenceLength;
    existingProduct.group_code = productData.GroupCode;
    existingProduct.vfp_code = productData.VFPCode;
    existingProduct.vgp_code = productData.VGPCode;
    existingProduct.general_data_message = productData.GeneralDataMessage;
    existingProduct.dealer_code = productData.DealerCode;
    existingProduct.dealer_type = productData.DealerType;
    existingProduct.group_key = productData.GroupKey;
    existingProduct.image_code = productData.ImageCode;
    existingProduct.pin_expiry_time = productData.PinExpiryTime;
    existingProduct.mandatory_fields = productData.MandatoryFields;
    existingProduct.visible_fields = productData.VisibleFields;

    const savedProduct = await this.ubiqfyProductRepo.save(existingProduct);

    // Delete existing options and create new ones
    await this.ubiqfyProductOptionRepo.delete({ product_id: savedProduct.id });

    if (
      productData.ProductOptionsList &&
      productData.ProductOptionsList.length > 0
    ) {
      await this.saveProductOptions(
        savedProduct.id,
        productData.ProductOptionsList,
        productData.ProductCurrencyCode,
      );
    }

    const productWithOptions = await this.ubiqfyProductRepo.findOne({
      where: { id: savedProduct.id },
      relations: ['options'],
    });

    if (!productWithOptions) {
      throw new Error(
        `Product with id ${savedProduct.id} not found after update`,
      );
    }

    return productWithOptions;
  }

  private async saveProductOptions(
    productId: string,
    optionsData: any[],
    productCurrencyCode?: string,
  ): Promise<void> {
    for (const optionData of optionsData) {
      const option = this.ubiqfyProductOptionRepo.create({
        product_id: productId,
        product_option_code: optionData.ProductOptionCode,
        name: optionData.Name,
        ean_sku_upc: optionData.EanSkuUpc,
        description: optionData.Description,
        logo_url: optionData.Logo,
        value: optionData.Value,
        min_face_value: optionData.MinMaxFaceRangeValue?.MinFaceValue,
        max_face_value: optionData.MinMaxFaceRangeValue?.MaxFaceValue,
        product_currency_code: productCurrencyCode, // Use product's currency code
        min_value: optionData.MinMaxRangeValue?.MinValue,
        max_value: optionData.MinMaxRangeValue?.MaxValue,
        min_wholesale_value: optionData.MinMaxRangeValue?.MinWholesaleValue,
        max_wholesale_value: optionData.MinMaxRangeValue?.MaxWholesaleValue,
      });

      await this.ubiqfyProductOptionRepo.save(option);
    }
  }

  async findAllProducts(): Promise<UbiqfyProduct[]> {
    return await this.ubiqfyProductRepo.find({
      relations: ['options'],
      order: { created_at: 'DESC' },
    });
  }

  async findProductById(id: string): Promise<UbiqfyProduct | null> {
    return await this.ubiqfyProductRepo.findOne({
      where: { id },
      relations: ['options'],
    });
  }

  async findProductByCode(productCode: string): Promise<UbiqfyProduct | null> {
    return await this.ubiqfyProductRepo.findOne({
      where: { product_code: productCode },
      relations: ['options'],
    });
  }

  async deleteProduct(id: string): Promise<void> {
    await this.ubiqfyProductRepo.delete(id);
  }
}

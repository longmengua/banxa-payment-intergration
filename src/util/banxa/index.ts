import crypto from 'node:crypto';
import { Utility } from '../utility';
import {
  BanxaGetRequestI,
  BanxaNFTOrderI,
  BanxaParamI,
  BanxaPostRequestI,
  BanxaNFTWebHooksI,
  BanxaCurrencyListResponseI,
  BanxaMethodListResponseI,
  BanxaTokenOrderI,
  BanxaGetOrdersParamI,
  BanxaNFTOrderStatusI,
  BanxaPriceParamI,
} from './type';

// https://docs.banxa.com/docs/step-3-authentication
export class BANXA_PAYMENT {
  static domain = process.env?.BANXA_DOMAIN || '';
  static key = process.env?.BANXA_KEY || '';
  static secret = process.env?.BANXA_SECRET || '';

  // get current nonce
  static buildNonce = () => Math.round(new Date().getTime() / 1000);

  // build Hmac
  static buildHmac = (p: BanxaParamI) => {
    let signature = p.method + '\n' + p.apiUrl + '\n' + p.nonce.toString();
    if (p.queryParam) {
      signature += p.queryParam ? `\n${JSON.stringify(p.queryParam)}` : '';
      console.log('======= signature');
      console.log(signature);
    }
    const localSignature = crypto.createHmac('SHA256', this.secret).update(signature).digest('hex');
    return `Bearer ${this.key}:${localSignature}:${p.nonce}`;
  };

  // build header
  static buildHeader = async (p: BanxaParamI) => {
    const hmac = this.buildHmac(p);
    const headers = new Headers();
    headers.append('Content-type', 'application/json');
    headers.append('Accept', 'application/json');
    headers.append('Authorization', hmac);
    return headers;
  };

  // build fetch request
  static buildFetch = async <T>(param: BanxaGetRequestI | BanxaPostRequestI): Promise<T> => {
    const p: BanxaParamI = {
      method: param?.method,
      apiUrl: param?.apiUrl,
      nonce: this.buildNonce(),
      queryParam: 'queryParam' in param ? param?.queryParam : undefined,
    };
    const headers = await this.buildHeader(p);
    const outcome = await fetch(`${this.domain}/${p.apiUrl}`, {
      method: p.method,
      headers,
    })
      .then((res) => {
        return res.json();
      })
      .catch((e) => {
        console.log(e);
        throw e;
      });
    return outcome;
  };

  // webhooks - POST, for banxa to notify us the status of the NFT order
  static upsertNFTByBanxa = async (p: BanxaNFTWebHooksI, dbUpsertFunc: (p: BanxaNFTWebHooksI) => Promise<any>) => {
    try {
      await dbUpsertFunc(p);
      return {
        status: 'true',
      };
    } catch (e) {
      return {
        status: 'false',
      };
    }
  };

  // webhooks - GET, for banxa to check whether the NFT is on the customer side or not.
  static checkNFTByBanxa = async (
    p: BanxaNFTWebHooksI,
    dbQueryFunc: (p: BanxaNFTWebHooksI) => Promise<{
      id: string;
      hash: string;
      status: BanxaNFTOrderStatusI;
    }>,
  ) => {
    return await dbQueryFunc(p);
  };

  // create token order
  // Allows your customer to create a buy or sell crypto order with Banxa.
  // Upon success, the response will contain a checkout URL which will be unique for the order.
  // The customer will be redirected to this URL to complete the checkout process,
  // which will expire after 1 minute if a redirect does not occur.
  static createTokenOrder = async (queryParam: BanxaTokenOrderI, orderType: 'buy' | 'sell') => {
    const p: BanxaPostRequestI = {
      method: 'POST',
      apiUrl: `/api/orders/${orderType}`,
      queryParam: queryParam,
    };
    return await this.buildFetch(p);
  };

  // create NFT order
  static createNFTOrder = async (queryParam: BanxaNFTOrderI<any>, orderType: 'buy' | 'sell') => {
    const p: BanxaPostRequestI = {
      method: 'POST',
      apiUrl: `/api/orders/nft/${orderType}`,
      queryParam: queryParam,
    };
    return await this.buildFetch(p);
  };

  // get supported currency list.
  static fetchFiatCurrencyList = async (): Promise<BanxaCurrencyListResponseI> => {
    const p: BanxaGetRequestI = {
      method: 'GET',
      apiUrl: 'api/fiats/buy',
    };
    return await this.buildFetch(p);
  };

  // get supported payment method list.
  static fetchPaymentMethodList = async (): Promise<BanxaMethodListResponseI> => {
    const p: BanxaGetRequestI = {
      method: 'GET',
      apiUrl: 'api/payment-methods',
    };
    return await this.buildFetch(p);
  };

  // Retrieve all available cryptocurrencies of buy or sell
  static fetchCurrncyList = async (orderType: 'buy' | 'sell') => {
    const p: BanxaGetRequestI = {
      method: 'GET',
      apiUrl: `api/coins/${orderType}`,
    };
    return await this.buildFetch(p);
  };

  // Retrieve all available countries
  static fetchCountryList = async () => {
    const p: BanxaGetRequestI = {
      method: 'GET',
      apiUrl: `api/countries`,
    };
    return await this.buildFetch(p);
  };

  // Retrieve all available US States
  static fetchUSStatesList = async () => {
    const p: BanxaGetRequestI = {
      method: 'GET',
      apiUrl: `api/countries/us/states`,
    };
    return await this.buildFetch(p);
  };

  // Get prices for all available payment methods or
  // for a single payment method.
  // Note that this endpoint should only be called
  // when a user requests prices by providing the cryptocurrency,
  // fiat and ideally amounts and payment method.
  // This endpoint is for dynamic quotations
  // and not to retrieve a list
  // of static prices that can be cached.
  // As a result, the endpoint is rate limited.
  static fetchPrice = async (param: BanxaPriceParamI) => {
    const p: BanxaGetRequestI = {
      method: 'GET',
      apiUrl: `api/prices${Utility.queryStrConvert(param)}`,
    };
    return await this.buildFetch(p);
  };

  // Retrieves details for single order that has been submitted.
  static fetchOrderByOrderId = async (orderId: string) => {
    const p: BanxaGetRequestI = {
      method: 'GET',
      apiUrl: `api/orders/${orderId}`,
    };
    return await this.buildFetch(p);
  };

  // Retrieves details for a bulk of orders
  // that have been submitted within a given time range
  // and optionally by order status or customer.
  static fetchOrders = async (param: BanxaGetOrdersParamI) => {
    const p: BanxaGetRequestI = {
      method: 'GET',
      apiUrl: `api/orders${Utility.queryStrConvert(param)}`,
    };
    return await this.buildFetch(p);
  };
}

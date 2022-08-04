import crypto from 'node:crypto';
import { BanxaGetRequestI, BanxaPaymentNFTOrderI, BanxaParamI, BanxaPostRequestI, BanxaWebHooksI, BanxaCurrencyListResponseI, BanxaPaymentMethodListResponseI } from './type';

// https://docs.banxa.com/docs/step-3-authentication
export class BANXA_PAYMENT {
  static domain = process.env?.BANXA_DOMAIN || '';
  static key = process.env?.BANXA_KEY || '';
  static secret = process.env?.BANXA_SECRET || '';
  
  // get current nonce
  static buildNonce = () => Math.round(new Date().getTime() / 1000)

  // build Hmac
  static buildHmac = (p: BanxaParamI) => {
    let signature = p.method + '\n' + p.apiUrl + '\n' + p.nonce.toString();
    if(p.queryParam){
      signature += p.queryParam ? `\n${JSON.stringify(p.queryParam)}` : '';
      console.log('======= signature')
      console.log(signature)
    } 
    const localSignature = crypto.createHmac("SHA256", this.secret).update(signature).digest("hex");
    return `Bearer ${this.key}:${localSignature}:${p.nonce}`;
  }

  // build header
  static buildHeader = async (p: BanxaParamI) => {
    const hmac = this.buildHmac(p)
    const headers = new Headers();
    headers.append('Content-type', 'application/json')
    headers.append('Accept', 'application/json')
    headers.append('Authorization', hmac)
    return headers;
  }

  // build fetch request
  static buildFetch = async <T>(param: BanxaGetRequestI | BanxaPostRequestI): Promise<T> => {
    const p: BanxaParamI = {
      method: param?.method,
      apiUrl: param?.apiUrl,
      nonce: this.buildNonce(), 
      queryParam: 'queryParam' in param ? param?.queryParam : undefined,
    }
    const headers = await this.buildHeader(p);
    const outcome = await fetch(
      `${this.domain}/${p.apiUrl}`, 
      {
        method: p.method,
        headers,
      },
    ).then(res => {
      return res.json();
    }).catch(e => {
      console.log(e);
      throw e;
    });
    return outcome;
  }

  // get supported currency list.
  static fetchFiatCurrencyList = async (): Promise<BanxaCurrencyListResponseI> => {
    const p: BanxaGetRequestI = {
      method: 'GET',
      apiUrl: 'api/fiats/buy',
    };
    return await this.buildFetch(p);
  }

  // get supported payment method list.
  static fetchPaymentMethodList = async (): Promise<BanxaPaymentMethodListResponseI> => {
    const p: BanxaGetRequestI = {
      method: 'GET',
      apiUrl: 'api/payment-methods',
    }
    return await this.buildFetch(p);
  }
  
  // create NFT order
  static buyNFT = async (queryParam: BanxaPaymentNFTOrderI) => {
    const p: BanxaPostRequestI = {
      method: 'POST',
      apiUrl: '/api/orders/nft/buy',
      queryParam: queryParam,
    }
    return await this.buildFetch(p);
  }

  // webhooks - POST, for banxa to notify us the status of the NFT order
  static updateNFTByBanxa = async (p: BanxaWebHooksI): Promise<{
    status: string,
  }> => {
    try {
      // todo: TBI
      return {
        status: 'true',
      };
    } catch (e) {
      return {
        status: 'false',
      }
    }
  }

  // webhooks - GET, for banxa to check whether the NFT is on the customer side or not.
  static checkNFTByBanxa = async (p: BanxaWebHooksI): Promise<{
    id: string,
    hash: string,
    status: string,
  }>  => {
    // todo: TBI
    const res = {
      "id":"234562345",
      "hash":"2345e6uiouytew43q234567uyikjhg",
      "status":"Pending", // please refer to BanxaWebHooksI orderStatus type
    }
    return res;
  }
}
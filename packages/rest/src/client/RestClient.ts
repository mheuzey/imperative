/*
* This program and the accompanying materials are made available under the terms of the
* Eclipse Public License v2.0 which accompanies this distribution, and is available at
* https://www.eclipse.org/legal/epl-v20.html
*
* SPDX-License-Identifier: EPL-2.0
*
* Copyright Contributors to the Zowe Project.
*
*/

import { AbstractSession } from "../session/AbstractSession";
import { RestConstants } from "./RestConstants";
import { HTTP_VERB } from "./types/HTTPVerb";
import { AbstractRestClient } from "./AbstractRestClient";
import { JSONUtils } from "../../../utilities";
import { Readable, Writable } from "stream";
import { ITaskWithStatus } from "../../../operations";
import { IFullResponseOptions } from "./doc/IFullResponseOptions";
import { IRestClientResponse } from "./doc/IRestClientResponse";
import { IOptionsFullRequest } from "./doc/IOptionsFullRequest";
import { CLIENT_PROPERTY } from "./types/AbstractRestClientProperties";

/**
 * Class to handle http(s) requests, build headers, collect data, report status codes, and header responses
 * and passes control to session object for maintaining connection information (tokens, checking for timeout, etc...)
 * @export
 * @class RestClient
 * @extends {AbstractRestClient}
 */
export class RestClient extends AbstractRestClient {

    /**
     * Wrap get for common error handling and supporting generic JSON types
     * @static
     * @template T - object type to return
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - the API URI that we are targeting
     * @param {any[]} reqHeaders - headers for the http(s) request
     * @returns {Promise<T>} - object on promise
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static async getExpectJSON<T extends object>(session: AbstractSession, resource: string,
                                                        reqHeaders: any[] = []): Promise<T> {
        const data = await this.getExpectString(session, resource, reqHeaders);
        return JSONUtils.parse<T>(data, "The get request appeared to succeed, but the response was not in the expected format");
    }

    /**
     * Wrap put for common error handling and supporting generic JSON types
     * @static
     * @template T - object type to return
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - the API URI that we are targeting
     * @param {any[]} reqHeaders - headers for the http(s) request
     * @param {any} payload - data to write on the http(s) request
     * @returns {Promise<T>} - object on promise
     * @throws  if the request gets a status code outside of the 200 range
     *                                   or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static async putExpectJSON<T extends object>(session: AbstractSession, resource: string,
                                                        reqHeaders: any[] = [], payload: any): Promise<T> {
        const data = await this.putExpectString(session, resource, reqHeaders, payload);
        return JSONUtils.parse<T>(data, "The put request appeared to succeed, but the response was not in the expected format");
    }

    /**
     * Wrap post for common error handling and supporting generic JSON types
     * @static
     * @template T - object type to return
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - the API URI that we are targeting
     * @param {any[]} reqHeaders - headers for the http(s) request
     * @param {any} payload - data to write on the http(s) request
     * @returns {Promise<T>} - object on promise
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static async postExpectJSON<T extends object>(session: AbstractSession, resource: string,
                                                         reqHeaders: any[] = [], payload?: any): Promise<T> {
        const data = await this.postExpectString(session, resource, reqHeaders, payload);
        return JSONUtils.parse<T>(data, "The post request appeared to succeed, but the response was not in the expected format");
    }

    /**
     * Wrap post for common error handling and supporting generic JSON types
     * @static
     * @template T - object type to return
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - the API URI that we are targeting
     * @param {any[]} reqHeaders - headers for the http(s) request
     * @returns {Promise<T>} - object on promise
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static async deleteExpectJSON<T extends object>(session: AbstractSession, resource: string, reqHeaders: any[] = []): Promise<T> {
        const data = await this.deleteExpectString(session, resource, reqHeaders);
        return JSONUtils.parse<T>(data, "The delete request appeared to succeed, but the response was not in the expected format");
    }

    /**
     * REST HTTP GET operation
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - URI for which this request should go against
     * @param {any} reqHeaders - headers to include in the REST request
     * @returns {Promise<Buffer>} - response body content from http(s) call
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static async getExpectBuffer(session: AbstractSession, resource: string, reqHeaders: any[] = []): Promise<Buffer> {
        const client = new this(session);
        await client.performRest(resource, HTTP_VERB.GET, reqHeaders);
        return client.data;
    }

    /**
     * REST HTTP PUT operation
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - URI for which this request should go against
     * @param {object[]} reqHeaders - headers to include in the REST request
     * @param {any} data - payload data
     * @returns {Promise<Buffer>} - response body content from http(s) call
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static async putExpectBuffer(session: AbstractSession, resource: string, reqHeaders: any[] = [], data: any): Promise<Buffer> {
        const client = new this(session);
        await client.performRest(resource, HTTP_VERB.PUT, reqHeaders, data);
        return client.data;
    }

    /**
     * REST HTTP POST operation
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - URI for which this request should go against
     * @param {object[]} reqHeaders - headers to include in the REST request
     * @param {any} data - payload data
     * @returns {Promise<Buffer>} - response body content from http(s) call
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static async postExpectBuffer(session: AbstractSession, resource: string, reqHeaders: any[] = [], data?: any): Promise<Buffer> {
        const client = new this(session);
        await client.performRest(resource, HTTP_VERB.POST, reqHeaders, data);
        return client.data;
    }

    /**
     * REST HTTP DELETE operation
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - URI for which this request should go against
     * @param {any} reqHeaders - headers to include in the REST request
     * @returns {Promise<Buffer>} - response body content from http(s) call
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static async deleteExpectBuffer(session: AbstractSession, resource: string, reqHeaders: any[] = []): Promise<Buffer> {
        const client = new this(session);
        await client.performRest(resource, HTTP_VERB.DELETE, reqHeaders);
        return client.data;
    }

    /**
     * REST HTTP GET operation
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - URI for which this request should go against
     * @param {any} reqHeaders - headers to include in the REST request
     * @returns {Promise<string>} - response body content from http(s) call
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static getExpectString(session: AbstractSession, resource: string, reqHeaders: any[] = []): Promise<string> {
        return new this(session).performRest(resource, HTTP_VERB.GET, reqHeaders);
    }

    /**
     * REST HTTP PUT operation
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - URI for which this request should go against
     * @param {object[]} reqHeaders - headers to include in the REST request
     * @param {any} data - payload data
     * @returns {Promise<string>} - response body content from http(s) call
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static putExpectString(session: AbstractSession, resource: string, reqHeaders: any[] = [], data: any): Promise<string> {
        return new this(session).performRest(resource, HTTP_VERB.PUT, reqHeaders, data);
    }

    /**
     * REST HTTP POST operation
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - URI for which this request should go against
     * @param {object[]} reqHeaders - headers to include in the REST request
     * @param {any} data - payload data
     * @returns {Promise<string>} - response body content from http(s) call
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static postExpectString(session: AbstractSession, resource: string, reqHeaders: any[] = [], data?: any): Promise<string> {
        return new this(session).performRest(resource, HTTP_VERB.POST, reqHeaders, data);
    }

    /**
     * REST HTTP DELETE operation
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - URI for which this request should go against
     * @param {any} reqHeaders - headers to include in the REST request
     * @returns {Promise<string>} - response body content from http(s) call
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static deleteExpectString(session: AbstractSession, resource: string, reqHeaders: any[] = []): Promise<string> {
        return new this(session).performRest(resource, HTTP_VERB.DELETE, reqHeaders);
    }

    /**
     * REST HTTP GET operation - streaming the response to a writable stream
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - URI for which this request should go against
     * @param {any} reqHeaders - headers to include in the REST request
     * @param responseStream - the stream to which the response data will be written
     * @param normalizeResponseNewLines - streaming only - true if you want newlines to be \r\n on windows
     *                                    when receiving data from the server to responseStream. Don't set this for binary responses
     * @param {ITaskWithStatus} task - task used to update the user on the progress of their request
     * @returns {Promise<string>} - empty string - data is not buffered for this request
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static getStreamed(session: AbstractSession, resource: string, reqHeaders: any[] = [],
                              responseStream: Writable,
                              normalizeResponseNewLines?: boolean,
                              task?: ITaskWithStatus): Promise<string> {
        return new this(session).performRest(resource, HTTP_VERB.GET, reqHeaders, undefined, responseStream,
            undefined, normalizeResponseNewLines, undefined, task);
    }

    /**
     * REST HTTP PUT operation with streamed response and request
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - URI for which this request should go against
     * @param {object[]} reqHeaders - headers to include in the REST request
     * @param {any} responseStream - stream to which the response data will be written
     * @param {any} requestStream - stream from which payload data will be read
     * @param normalizeResponseNewLines - streaming only - true if you want newlines to be \r\n on windows
     *                                    when receiving data from the server to responseStream. Don't set this for binary responses
     * @param normalizeRequestNewLines -  streaming only - true if you want \r\n to be replaced with \n when sending
     *                                    data to the server from requestStream. Don't set this for binary requests
     * @param {ITaskWithStatus} task - task used to update the user on the progress of their request
     * @returns {Promise<string>} - empty string - data is not buffered for streamed requests
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static putStreamed(session: AbstractSession, resource: string, reqHeaders: any[] = [],
                              responseStream: Writable, requestStream: Readable,
                              normalizeResponseNewLines?: boolean, normalizeRequestNewLines?: boolean,
                              task?: ITaskWithStatus): Promise<string> {
        return new this(session).performRest(resource, HTTP_VERB.PUT, reqHeaders, undefined, responseStream, requestStream,
            normalizeResponseNewLines, normalizeRequestNewLines, task);
    }

    /**
     * REST HTTP PUT operation with only streamed request, buffers response data and returns it
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - URI for which this request should go against
     * @param {object[]} reqHeaders - headers to include in the REST request
     * @param {any} requestStream - stream from which payload data will be read
     * @param normalizeRequestNewLines -  streaming only - true if you want \r\n to be replaced with \n when sending
     *                                    data to the server from requestStream. Don't set this for binary requests
     * @param {ITaskWithStatus} task - task used to update the user on the progress of their request
     * @returns {Promise<string>} - string of the response
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static putStreamedRequestOnly(session: AbstractSession, resource: string, reqHeaders: any[] = [],
                                         requestStream: Readable,
                                         normalizeRequestNewLines?: boolean,
                                         task?: ITaskWithStatus): Promise<string> {
        return new this(session).performRest(resource, HTTP_VERB.PUT, reqHeaders, undefined, undefined, requestStream,
            undefined, normalizeRequestNewLines, task);
    }

    /**
     * REST HTTP POST operation streaming both the request and the response
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - URI for which this request should go against
     * @param {object[]} reqHeaders - headers to include in the REST request
     * @param {any} responseStream - stream to which the response data will be written
     * @param {any} requestStream - stream from which payload data will be read
     * @param normalizeResponseNewLines - streaming only - true if you want newlines to be \r\n on windows
     *                                    when receiving data from the server to responseStream. Don't set this for binary responses
     * @param normalizeRequestNewLines -  streaming only - true if you want \r\n to be replaced with \n when sending
     *                                    data to the server from requestStream. Don't set this for binary requests
     * @param {ITaskWithStatus} task - task used to update the user on the progress of their request
     * @returns {Promise<string>} - empty string - data is not buffered for  this request
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static postStreamed(session: AbstractSession, resource: string, reqHeaders: any[] = [],
                               responseStream: Writable, requestStream: Readable,
                               normalizeResponseNewLines?: boolean, normalizeRequestNewLines?: boolean,
                               task?: ITaskWithStatus): Promise<string> {
        return new this(session).performRest(resource, HTTP_VERB.POST, reqHeaders, undefined, responseStream, requestStream,
            normalizeResponseNewLines, normalizeRequestNewLines, task);
    }

    /**
     * REST HTTP POST operation, streaming only the request and not the response
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - URI for which this request should go against
     * @param {object[]} reqHeaders - headers to include in the REST request
     * @param {any} requestStream - stream from which payload data will be read
     * @param normalizeRequestNewLines -  streaming only - true if you want \r\n to be replaced with \n when sending
     *                                    data to the server from requestStream. Don't set this for binary requests
     * @param {ITaskWithStatus} task - task used to update the user on the progress of their request
     * @returns {Promise<string>} - string of the response
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static postStreamedRequestOnly(session: AbstractSession, resource: string, reqHeaders: any[] = [],
                                          requestStream: Readable, normalizeRequestNewLines?: boolean,
                                          task?: ITaskWithStatus): Promise<string> {
        return new this(session).performRest(resource, HTTP_VERB.POST, reqHeaders, undefined, undefined, requestStream,
            undefined, normalizeRequestNewLines, task);
    }

    /**
     * REST HTTP DELETE operation
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {string} resource - URI for which this request should go against
     * @param {any} reqHeaders - headers to include in the REST request
     * @param {any} responseStream - stream to which the response data will be written
     * @param {ITaskWithStatus} task - task used to update the user on the progress of their request
     * @param normalizeResponseNewLines - streaming only - true if you want newlines to be \r\n on windows
     *                                    when receiving data from the server to responseStream. Don't set this for binary responses
     * @returns {Promise<string>} - empty string - data is not buffered for streamed requests
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static deleteStreamed(session: AbstractSession, resource: string, reqHeaders: any[] = [], responseStream: Writable,
                                 normalizeResponseNewLines?: boolean,
                                 task?: ITaskWithStatus): Promise<string> {
        return new this(session).performRest(resource, HTTP_VERB.DELETE, reqHeaders,
            undefined, responseStream, undefined, normalizeResponseNewLines, undefined, task
        );
    }

    /**
     * REST HTTP GET operation returning full HTTP(S) Response
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {IOptionsFullRequest} options - URI for which this request should go against
     * @returns {Promise<IRestClientResponse>} - full response or filtered based on provided params
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static async getExpectFullResponse(session: AbstractSession,
                                              options: IOptionsFullRequest): Promise<IRestClientResponse> {
        const  requestOptions: IFullResponseOptions = {
            resource : options.resource,
            request : HTTP_VERB.GET,
            reqHeaders : options.reqHeaders,
            writeData : options.writeData,
            responseStream : options.responseStream,
            requestStream : options.requestStream,
            normalizeResponseNewLines : options.normalizeResponseNewLines,
            normalizeRequestNewLines : options.normalizeRequestNewLines,
            task : options.task,
        };

        const client = new this(session);
        // await client.performRest(resource, HTTP_VERB.GET, reqHeaders, undefined, responseStream,
        //                          undefined, normalizeResponseNewLines, undefined, task);
        await client.request(requestOptions);
        return this.extractExpectedData(client, options.dataToReturn);
    }

    /**
     * REST HTTP PUT operation returning full HTTP(S) Response
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {IOptionsFullRequest} options - list of parameters
     * @returns {Promise<IRestClientResponse>} - response content from http(s) call
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static async putExpectFullResponse(session: AbstractSession,
                                              options: IOptionsFullRequest): Promise<IRestClientResponse> {
        const  requestOptions: IFullResponseOptions = {
            resource : options.resource,
            request : HTTP_VERB.PUT,
            reqHeaders : options.reqHeaders,
            writeData: options.writeData,
            responseStream: options.responseStream,
            requestStream: options.requestStream,
            normalizeResponseNewLines: options.normalizeResponseNewLines,
            normalizeRequestNewLines: options.normalizeRequestNewLines,
            task: options.task,
        };

        const client = new this(session);
        // await client.performRest(options.resource, HTTP_VERB.PUT, reqHeaders, data);
        await client.request(requestOptions);
        return this.extractExpectedData(client, options.dataToReturn);
    }

    /**
     * REST HTTP delete operation returning full HTTP(S) Response
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {IOptionsFullRequest} options - list of parameters
     * @returns {Promise<IRestClientResponse>} - response content from http(s) call
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static async deleteExpectFullResponse(session: AbstractSession,
                                              options: IOptionsFullRequest): Promise<IRestClientResponse> {
        const  requestOptions: IFullResponseOptions = {
            resource : options.resource,
            request : HTTP_VERB.DELETE,
            reqHeaders : options.reqHeaders,
            writeData: options.writeData,
            responseStream: options.responseStream,
            requestStream: options.requestStream,
            normalizeResponseNewLines: options.normalizeResponseNewLines,
            normalizeRequestNewLines: options.normalizeRequestNewLines,
            task: options.task,
        };

        const client = new this(session);
        // await client.performRest(options.resource, HTTP_VERB.PUT, reqHeaders, data);
        await client.request(requestOptions);
        return this.extractExpectedData(client, options.dataToReturn);
    }

    /**
     * REST HTTP post operation returning full HTTP(S) Response
     * @static
     * @param {AbstractSession} session - representing connection to this api
     * @param {IOptionsFullRequest} options - list of parameters
     * @returns {Promise<IRestClientResponse>} - response content from http(s) call
     * @throws  if the request gets a status code outside of the 200 range
     *          or other connection problems occur (e.g. connection refused)
     * @memberof RestClient
     */
    public static async postExpectFullResponse(session: AbstractSession,
                                              options: IOptionsFullRequest): Promise<IRestClientResponse> {
        const  requestOptions: IFullResponseOptions = {
            resource : options.resource,
            request : HTTP_VERB.POST,
            reqHeaders : options.reqHeaders,
            writeData: options.writeData,
            responseStream: options.responseStream,
            requestStream: options.requestStream,
            normalizeResponseNewLines: options.normalizeResponseNewLines,
            normalizeRequestNewLines: options.normalizeRequestNewLines,
            task: options.task,
        };

        const client = new this(session);
        // await client.performRest(options.resource, HTTP_VERB.PUT, reqHeaders, data);
        await client.request(requestOptions);
        return this.extractExpectedData(client, options.dataToReturn);
    }

    /**
     * Helper method to return an indicator for whether or not a URI contains a query string.
     * @static
     * @param {string} query - URI
     * @returns {boolean} - true if query is contained within URI
     * @memberof RestClient
     */
    public static hasQueryString(query: string): boolean {
        return (query.slice(-1) !== RestConstants.QUERY_ID);
    }

    /**
     * Helper method to extract requested data from response object
     * If list is not passed, returns entire response
     * @static
     * @param {any} client - HTTP(S) response object
     * @param {string[]} toReturn - list with object properties to return
     * @returns {IRestClientResponse} - trimmed or full response object based on the list provided
     * @memberof RestClient
     */
    // private static extractExpectedData(client: AbstractRestClient, toReturn: CLIENT_PROPERTY[]): IRestClientResponse {
    private static extractExpectedData(client: AbstractRestClient,
                                       toReturn: CLIENT_PROPERTY[] = Object.values(CLIENT_PROPERTY)
                                       ): IRestClientResponse {
        const tailoredResult: any = {};
        // const listOfProperties = Object.keys(Object.getOwnPropertyDescriptors(client));
        toReturn.forEach((property) => {
            tailoredResult[property] = client[property];
        });
        // toReturn.forEach((property) => {
        //     if (listOfProperties.includes(property)) {
        //         // tailoredResult[property] = Object.entries(client).find((prop) => prop[0] === property)[1];
        //         tailoredResult[property] = client[(property as CLIENT_OPTION)];
        //     } else {
        //         tailoredResult[property] = null;
        //     }
        // });
        return tailoredResult as IRestClientResponse;
    }
}

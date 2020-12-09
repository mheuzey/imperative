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

import { CommandResponse, IHandlerParameters } from "../../../../..";
import { Config } from "../../../../../config/src/Config";
import { CliUtils, ImperativeConfig } from "../../../../../utilities";
import { IImperativeConfig } from "../../../../src/doc/IImperativeConfig";
import { expectedSchemaObject } from
    "../../../../../../__tests__/__integration__/imperative/__tests__/__integration__/cli/config/__resources__/expectedObjects"
import InitHandler from "../../../../src/config/cmd/init/init.handler";
import * as config from "../../../../../../__tests__/__integration__/imperative/src/imperative";
import * as path from "path";
import * as lodash from "lodash";
import * as fs from "fs";
import * as os from "os";

const getIHandlerParametersObject = (): IHandlerParameters => {
    const x: any = {
        response: new (CommandResponse as any)(),
        arguments: {
            package: undefined
            },
        };
    return x as IHandlerParameters;
};

const fakeConfig = config as IImperativeConfig;
const fakeProjPath = path.join(__dirname, "fakeapp.config.json");
const fakeSchemaPath = path.join(__dirname, "fakeapp.schema.json");
const fakeProjUserPath = path.join(__dirname, "fakeapp.config.user.json");

describe("Configuration Initialization command handler", () => {
    let writeFileSyncSpy: any;
    let existsSyncSpy: any;
    let osHomedirSpy: any;
    let currentWorkingDirectorySpy: any;
    let searchSpy: any;
    let setSchemaSpy: any;
    let promptWithTimeoutSpy: any;

    async function setupConfigToLoad() {
        // Load the ImperativeConfig so init can work properly

        // Steps to take before calling:
        // 1. Mock out Config.search the appropriate number of times
        // 2. Mock out fs.existsSync and/or fs.readFileSync the appropriate number of times

        osHomedirSpy.mockReturnValue(__dirname); // Pretend the current directory is the homedir
        currentWorkingDirectorySpy.mockReturnValue(__dirname); // Pretend the current directory is where the command was invoked
        ImperativeConfig.instance.config = await Config.load("fakeapp", {});
    }

    beforeEach( async () => {
        jest.resetAllMocks();
        ImperativeConfig.instance.loadedConfig = lodash.cloneDeep(fakeConfig);

        writeFileSyncSpy = jest.spyOn(fs, "writeFileSync");
        existsSyncSpy = jest.spyOn(fs, "existsSync");
        osHomedirSpy = jest.spyOn(os, "homedir");
        currentWorkingDirectorySpy = jest.spyOn(process, "cwd");
        searchSpy = jest.spyOn(Config, "search");
        setSchemaSpy = jest.spyOn(Config.prototype, "setSchema");
        promptWithTimeoutSpy = jest.spyOn(CliUtils, "promptWithTimeout");
    });

    afterAll( () => {
        jest.restoreAllMocks();
    })

    it("should attempt to initialize the project configuration", async () => {
        const handler = new InitHandler();
        const params = getIHandlerParametersObject();
        params.arguments.user = false;
        params.arguments.global = false;
        params.arguments.ci = false;

        existsSyncSpy.mockReturnValueOnce(true).mockReturnValue(false); // Only project config matters.
        searchSpy.mockReturnValueOnce(fakeProjPath); // Give search something to return
        await setupConfigToLoad(); // Setup the config

        // We aren't testing the config initialization - clear the spies
        existsSyncSpy.mockClear();
        searchSpy.mockClear();
        osHomedirSpy.mockClear();
        currentWorkingDirectorySpy.mockClear();

        // initWithSchema
        promptWithTimeoutSpy.mockReturnValue("fakeValue"); // Add fake values for all prompts
        writeFileSyncSpy.mockImplementation(); // Don't actually write files

        await handler.process(params as IHandlerParameters);

        const compObj: any = {};
        // Make changes to satisfy what would be stored on the JSON
        compObj.$schema = "./fakeapp.schema.json" // Fill in the name of the schema file, make it first
        lodash.merge(compObj, ImperativeConfig.instance.config.properties); // Add the properties from the config
        delete compObj.profiles.my_secured.properties.secret; // Delete the secret
        compObj.secure = ["profiles.my_secured.properties.secret"]; // Add the secret field to the secrets

        expect(setSchemaSpy).toHaveBeenCalledTimes(1);
        expect(setSchemaSpy).toHaveBeenCalledWith(expectedSchemaObject);
        expect(promptWithTimeoutSpy).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line: no-magic-numbers
        expect(promptWithTimeoutSpy).toHaveBeenCalledWith(expect.stringContaining("blank to skip:"), true, 900);
        expect(writeFileSyncSpy).toHaveBeenCalledTimes(2);
        // tslint:disable-next-line: no-magic-numbers
        expect(writeFileSyncSpy).toHaveBeenNthCalledWith(1, fakeSchemaPath, JSON.stringify(expectedSchemaObject, null, 4));
        // tslint:disable-next-line: no-magic-numbers
        expect(writeFileSyncSpy).toHaveBeenNthCalledWith(2, fakeProjPath, JSON.stringify(compObj, null, 4));

    });
    // it("should attempt to initialize the user configuration", async () => {
    //     const handler = new InitHandler();
    //     const params = getIHandlerParametersObject();
    //     params.arguments.user = true;
    //     params.arguments.global = false;
    //     params.arguments.ci = false;
    //     await handler.process(params as IHandlerParameters);
    // });
    // it("should attempt to initialize the global project configuration", async () => {
    //     const handler = new InitHandler();
    //     const params = getIHandlerParametersObject();
    //     params.arguments.user = false;
    //     params.arguments.global = true;
    //     params.arguments.ci = false;
    //     await handler.process(params as IHandlerParameters);
    // });
    // it("should attempt to initialize the global user configuration", async () => {
    //     const handler = new InitHandler();
    //     const params = getIHandlerParametersObject();
    //     params.arguments.user = true;
    //     params.arguments.global = true;
    //     params.arguments.ci = false;
    //     await handler.process(params as IHandlerParameters);
    // });
    // it("should attempt to initialize the project configuration with ci", async () => {
    //     const handler = new InitHandler();
    //     const params = getIHandlerParametersObject();
    //     params.arguments.user = false;
    //     params.arguments.global = false;
    //     params.arguments.ci = true;
    //     await handler.process(params as IHandlerParameters);
    // });
    // it("should attempt to initialize the user configuration with ci", async () => {
    //     const handler = new InitHandler();
    //     const params = getIHandlerParametersObject();
    //     params.arguments.user = true;
    //     params.arguments.global = false;
    //     params.arguments.ci = true;
    //     await handler.process(params as IHandlerParameters);
    // });
    // it("should attempt to initialize the global project configuration with ci", async () => {
    //     const handler = new InitHandler();
    //     const params = getIHandlerParametersObject();
    //     params.arguments.user = false;
    //     params.arguments.global = true;
    //     params.arguments.ci = true;
    //     await handler.process(params as IHandlerParameters);
    // });
    // it("should attempt to initialize the global user configuration with ci", async () => {
    //     const handler = new InitHandler();
    //     const params = getIHandlerParametersObject();
    //     params.arguments.user = true;
    //     params.arguments.global = true;
    //     params.arguments.ci = true;
    //     await handler.process(params as IHandlerParameters);
    // });
}
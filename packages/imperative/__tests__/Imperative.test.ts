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

import Mock = jest.Mock;
import { join } from "path";
import { generateRandomAlphaNumericString } from "../../../__tests__/src/TestUtil";
import { IImperativeConfig } from "../src/doc/IImperativeConfig";
import { IImperativeOverrides } from "../src/doc/IImperativeOverrides";
import { IConfigLogging } from "../../logger";
import { IImperativeEnvironmentalVariableSettings } from "..";
import { ICommandDefinition } from "../../cmd/src/doc/ICommandDefinition";
import { CommandTreeCache } from "../src/CommandTreeCache";

describe("Imperative", () => {
    const mainModule = process.mainModule;

    const loadImperative = () => {
        return require("../src/Imperative").Imperative;
    };

    const reloadExternalMocks = () => {
        try {
            jest.doMock("../src/OverridesLoader");
            jest.doMock("../src/LoggingConfigurer");
            jest.doMock("../src/ConfigurationLoader");
            jest.doMock("../src/ConfigurationValidator");
            jest.doMock("../src/help/ImperativeHelpGeneratorFactory");
            jest.doMock("../../utilities/src/ImperativeConfig");
            jest.doMock("../src/config/ConfigManagementFacility");
            jest.doMock("../src/plugins/PluginManagementFacility");
            jest.doMock("../../settings/src/AppSettings");
            jest.doMock("../../logger/src/Logger");
            jest.doMock("../src/env/EnvironmentalVariableSettings");

            const {OverridesLoader} = require("../src/OverridesLoader");
            const {LoggingConfigurer} = require("../src/LoggingConfigurer");
            const {ConfigurationLoader} = require("../src/ConfigurationLoader");
            const ConfigurationValidator = require("../src/ConfigurationValidator").ConfigurationValidator.validate;
            const {AppSettings} = require("../../settings");
            const {ImperativeConfig} = require("../../utilities/src/ImperativeConfig");
            const {ConfigManagementFacility} = require("../src/config/ConfigManagementFacility");
            const {PluginManagementFacility} = require("../src/plugins/PluginManagementFacility");
            const {Logger} = require("../../logger");
            const {EnvironmentalVariableSettings} = require("../src/env/EnvironmentalVariableSettings");
            return {
                OverridesLoader: {
                    load: OverridesLoader.load as Mock<typeof OverridesLoader.load>
                },
                ConfigurationLoader: {
                    load: ConfigurationLoader.load as Mock<typeof ConfigurationLoader.load>
                },
                ConfigurationValidator: {
                    validate: ConfigurationValidator.validate as Mock<typeof ConfigurationValidator.validate>
                },
                AppSettings: {
                    initialize: AppSettings.initialize as Mock<typeof AppSettings.initialize>
                },
                ImperativeConfig,
                ConfigManagementFacility,
                PluginManagementFacility,
                LoggingConfigurer,
                Logger,
                EnvironmentalVariableSettings
            };
        } catch (error) {
            // If we error here, jest silently fails and says the test is empty. So let's make sure
            // that doesn't happen!

            const { Logger } = (jest as any).requireActual("../../logger/src/Logger");

            Logger.getConsoleLogger().fatal("Imperative.test.ts test execution error!");
            Logger.getConsoleLogger().fatal(error);

            throw error;
        }
    };

    let mocks = reloadExternalMocks();
    let Imperative = loadImperative();
    let realGetResolvedCmdTree: any;
    let realGetPreparedCmdTree: any;
    const mockCmdTree = {
        name: "mockCmdTreeName",
        description: "Mock resolved (or prepared) command tree description",
        type: "group",
        children: [
            {
                name: "cmdFromCli",
                description: "dummy command",
                type: "command",
                handler: "./lib/cmd/someCmd/someCmd.handler"
            }
        ]
    };

    beforeEach(() => {
        (process.mainModule as any) = {
            filename: __filename
        };

        jest.resetModuleRegistry();

        // Refresh the imperative load every time
        mocks = reloadExternalMocks();
        Imperative = loadImperative();

        realGetResolvedCmdTree = Imperative.getResolvedCmdTree;
        Imperative.getResolvedCmdTree = jest.fn(() => mockCmdTree );

        realGetPreparedCmdTree = Imperative.getPreparedCmdTree;
        Imperative.getPreparedCmdTree = jest.fn(() => mockCmdTree );
    });

    afterEach(() => {
        process.mainModule = mainModule;
    });

    describe("init", () => {
        let defaultConfig: IImperativeConfig;

        beforeEach(() => {
            defaultConfig = {
                name: "test-cli",
                allowPlugins: false,
                allowConfigGroup: false,
                overrides: {
                    CredentialManager: "some-string.ts"
                }
            };

            (Imperative as any).constructApiObject = jest.fn(() => undefined);
            (Imperative as any).initProfiles = jest.fn(() => undefined);
            (Imperative as any).defineCommands = jest.fn(() => undefined);

            mocks.ConfigurationLoader.load.mockReturnValue(defaultConfig);
            mocks.OverridesLoader.load.mockReturnValue(new Promise((resolve) => resolve()));
        });

        it("should work when passed with nothing", async () => {
            // the thing that we really want to test
            const result = await Imperative.init();

            expect(result).toBeUndefined();
            expect(mocks.OverridesLoader.load).toHaveBeenCalledTimes(1);
            expect(mocks.OverridesLoader.load).toHaveBeenCalledWith(defaultConfig, {version: 10000, name: "sample"});
        });

        describe("AppSettings", () => {
            const defaultSettings =  {overrides: {CredentialManager: false}};
            it("should initialize an app settings instance", async () => {
                await Imperative.init();

                expect(mocks.AppSettings.initialize).toHaveBeenCalledTimes(1);
                expect(mocks.AppSettings.initialize).toHaveBeenCalledWith(
                    join(mocks.ImperativeConfig.instance.cliHome, "settings", "imperative.json"),
                    defaultSettings
                );
            });
        }); // End AppSettings

        describe("Config", () => {
            let ConfigManagementFacility = mocks.ConfigManagementFacility;

            beforeEach(() => {
                defaultConfig.allowConfigGroup = true;
                ConfigManagementFacility = mocks.ConfigManagementFacility;
            });

            it("should call config functions when config group is allowed", async () => {
                await Imperative.init();

                expect(ConfigManagementFacility.instance.init).toHaveBeenCalledTimes(1);
            });
        });

        describe("Plugins", () => {
            let PluginManagementFacility = mocks.PluginManagementFacility;

            beforeEach(() => {
                defaultConfig.allowPlugins = true;
                PluginManagementFacility = mocks.PluginManagementFacility;
            });

            it("should call plugin functions when plugins are allowed", async () => {
                await Imperative.init();

                expect(PluginManagementFacility.instance.init).toHaveBeenCalledTimes(1);
                expect(PluginManagementFacility.instance.loadAllPluginCfgProps).toHaveBeenCalledTimes(1);

                expect(PluginManagementFacility.instance.addAllPluginsToHostCli).toHaveBeenCalledTimes(1);
                expect(
                    PluginManagementFacility.instance.addAllPluginsToHostCli
                ).toHaveBeenCalledWith(Imperative.getResolvedCmdTree());
            });

            // @FUTURE When there are more overrides we should think about making this function dynamic
            it("should allow a plugin to override modules", async () => {
                const testOverrides: IImperativeOverrides = {
                    CredentialManager: generateRandomAlphaNumericString(16) //tslint:disable-line
                };

                // Formulate a deep copy of the expected overrides. Ensures that we are comparing values
                // and not references to values.
                const expectedConfig = JSON.parse(JSON.stringify(defaultConfig));
                Object.assign(expectedConfig.overrides, JSON.parse(JSON.stringify(testOverrides)));

                PluginManagementFacility.instance.pluginOverrides = testOverrides;

                await Imperative.init();

                expect(mocks.ImperativeConfig.instance.loadedConfig).toEqual(expectedConfig);
            });

            it("should not override modules not specified by a plugin", async () => {
                const expectedConfig = JSON.parse(JSON.stringify(defaultConfig));

                PluginManagementFacility.instance.pluginOverrides = {};

                await Imperative.init();

                expect(mocks.ImperativeConfig.instance.loadedConfig).toEqual(expectedConfig);
            });
        }); // End Plugins

        describe("Logging", () => {
            it("should properly call external methods", async () => {
                await Imperative.init();

                expect(mocks.LoggingConfigurer.configureLogger).toHaveBeenCalledTimes(1);
                expect(mocks.LoggingConfigurer.configureLogger).toHaveBeenCalledWith(
                    mocks.ImperativeConfig.instance.cliHome,
                    mocks.ImperativeConfig.instance.loadedConfig
                );

                expect(mocks.Logger.initLogger).toHaveBeenCalledTimes(1);
                expect(mocks.Logger.initLogger).toHaveBeenCalledWith(
                    mocks.LoggingConfigurer.configureLogger("a", {})
                );
            });

            describe("Environmental Var", () => {
                let loggingConfig: IConfigLogging;
                let envConfig: IImperativeEnvironmentalVariableSettings;

                const goodLevel = "WARN";
                const badLevel = "NOGOOD";

                beforeEach(() => {
                    loggingConfig = mocks.LoggingConfigurer.configureLogger("dont care", {});
                    envConfig = mocks.EnvironmentalVariableSettings.read(Imperative.envVariablePrefix);
                });

                it("should handle a valid imperative log level", async () => {
                    envConfig.imperativeLogLevel.value = goodLevel;
                    loggingConfig.log4jsConfig.categories[mocks.Logger.DEFAULT_IMPERATIVE_NAME].level = goodLevel;

                    mocks.EnvironmentalVariableSettings.read.mockReturnValue(envConfig);
                    mocks.Logger.isValidLevel.mockReturnValue(true);

                    await Imperative.init();

                    expect(mocks.Logger.isValidLevel).toHaveBeenCalledTimes(1);
                    expect(mocks.Logger.isValidLevel).toHaveBeenCalledWith(goodLevel);

                    expect(mocks.Logger.initLogger).toHaveBeenCalledTimes(1);
                    expect(mocks.Logger.initLogger).toHaveBeenCalledWith(loggingConfig);
                });

                it("should handle an invalid imperative log level", async () => {
                    envConfig.imperativeLogLevel.value = badLevel;

                    mocks.EnvironmentalVariableSettings.read.mockReturnValue(envConfig);
                    mocks.Logger.isValidLevel.mockReturnValue(false);

                    await Imperative.init();

                    expect(mocks.Logger.isValidLevel).toHaveBeenCalledTimes(1);
                    expect(mocks.Logger.isValidLevel).toHaveBeenCalledWith(badLevel);

                    expect(mocks.Logger.initLogger).toHaveBeenCalledTimes(1);
                    expect(mocks.Logger.initLogger).toHaveBeenCalledWith(loggingConfig);
                });

                it("should handle a valid app log level", async () => {
                    envConfig.appLogLevel.value = goodLevel;
                    loggingConfig.log4jsConfig.categories[mocks.Logger.DEFAULT_APP_NAME].level = goodLevel;

                    mocks.EnvironmentalVariableSettings.read.mockReturnValue(envConfig);
                    mocks.Logger.isValidLevel.mockReturnValue(true);

                    await Imperative.init();

                    expect(mocks.Logger.isValidLevel).toHaveBeenCalledTimes(1);
                    expect(mocks.Logger.isValidLevel).toHaveBeenCalledWith(goodLevel);

                    expect(mocks.Logger.initLogger).toHaveBeenCalledTimes(1);
                    expect(mocks.Logger.initLogger).toHaveBeenCalledWith(loggingConfig);
                });

                it("should handle an invalid imperative log level", async () => {
                    envConfig.appLogLevel.value = badLevel;

                    mocks.EnvironmentalVariableSettings.read.mockReturnValue(envConfig);
                    mocks.Logger.isValidLevel.mockReturnValue(false);

                    await Imperative.init();

                    expect(mocks.Logger.isValidLevel).toHaveBeenCalledTimes(1);
                    expect(mocks.Logger.isValidLevel).toHaveBeenCalledWith(badLevel);

                    expect(mocks.Logger.initLogger).toHaveBeenCalledTimes(1);
                    expect(mocks.Logger.initLogger).toHaveBeenCalledWith(loggingConfig);
                });
            });
        }); // End Logging
    }); // end describe init

    describe("error handling", () => {
        const loadImperativeError = () => {
            return require("../../error").ImperativeError;
        };

        // Because of how we are loading things, we have to reload the imperative error to do testing
        let ImperativeError = loadImperativeError();
        beforeEach(() => {
            ImperativeError = loadImperativeError();
        });

        it("handles a non imperative error", async () => {
            const error = new Error("Should throw this error!");
            let caughtError: Error;

            mocks.ConfigurationLoader.load.mockImplementationOnce(() => {
                throw error;
            });

            try {
                await Imperative.init();
            } catch (e) {
                caughtError = e;
            }

            expect(caughtError).toBeInstanceOf(ImperativeError);
            expect(caughtError.message).toEqual("UNEXPECTED ERROR ENCOUNTERED");
            expect((caughtError as any).details.causeErrors).toEqual(error);
        });

        it("should propagate an ImperativeError up", async () => {
            const error = new ImperativeError({
                msg: "This is an imperative error",
                additionalDetails: "Something",
                causeErrors:
                    new Error("Some internal error")
            });

            mocks.ConfigurationLoader.load.mockImplementationOnce(() => {
                throw error;
            });

            let caughtError: Error;

            try {
                await Imperative.init();
            } catch (e) {
                caughtError = e;
            }

            expect(caughtError).toBe(error);
        });
    });

    describe("getResolvedCmdTree", () => {
        it("should deliver cmd tree from DefinitionTreeResolver", async () => {
            /// mock imput and output of getResolvedCmdTree for testing
            const mockConfigObj: IImperativeConfig = {};
            const expectedCmdDef: ICommandDefinition = {
                name: "expectedCmdName",
                description: "Expected description from DefinitionTreeResolver.resolve",
                type: "command"
            };

            /* getResolvedCmdTree calls getCallerLocation, and we need it to return some string.
             * getCallerLocation is a getter of a property, so mock we the property.
             */
            Object.defineProperty(mocks.ImperativeConfig.instance, "callerLocation", {
                configurable: true,
                get: jest.fn(() => {
                    return "../..";
                })
            });

            /* getResolvedCmdTree calls DefinitionTreeResolver.resolve.
             * We need it to return an expected command tree.
             */
            const {DefinitionTreeResolver} = require("../src/DefinitionTreeResolver");
            DefinitionTreeResolver.resolve = jest.fn(() => expectedCmdDef);

            // we want to test the real getResolvedCmdTree, not a mocked one
            Imperative.getResolvedCmdTree = realGetResolvedCmdTree;
            const resolvedCmdTree = Imperative.getResolvedCmdTree(mockConfigObj);
            expect(resolvedCmdTree).toBe(expectedCmdDef);
        });
    });

    describe("getPreparedCmdTree", () => {
        it("should deliver cmd tree from CommandPreparer.prepare", async () => {
            /// mock imput and output of getPreparedCmdTree for testing
            const expectedCmdTree: ICommandDefinition = {
                name: "resolvedCmdName",
                description: "Resolved description",
                type: "command"
            };

            /* getPreparedCmdTree calls CommandPreparer.prepare.
             * We need it to return an expected command tree.
             */
            const {CommandPreparer} = require("../../cmd/src/CommandPreparer");
            CommandPreparer.prepare = jest.fn(() => expectedCmdTree);

            // we want to test the real getPreparedCmdTree, not a mocked one
            Imperative.getPreparedCmdTree = realGetPreparedCmdTree;
            const preparedCmdTree = Imperative.getPreparedCmdTree(expectedCmdTree);
            expect(preparedCmdTree).toBe(expectedCmdTree);
        });
    });

    describe("addAutoGeneratedCommands", () => {
        it("should call getProfileGroup when we need to auto-generate commands", async () => {
            const mockRootCmdTree: ICommandDefinition = {
                name: "mockRootCmdName",
                description: "Description of a mock root commande",
                type: "group",
                children: []
            };

            /* addAutoGeneratedCommands calls ImperativeConfig.instance.loadedConfig.
             * getLoadedConfig is a getter of a property, so mock we the property.
             * We need loadedConfig.autoGenerateProfileCommands to be null and
             * loadedConfig.profiles to have something in it.
             */
            Object.defineProperty(mocks.ImperativeConfig.instance, "loadedConfig", {
                configurable: true,
                get: jest.fn(() => {
                    return {
                        autoGenerateProfileCommands: null,
                        profiles: [
                            {
                                type: "mockProfType",
                                schema: {
                                    type: "object",
                                    title: "mock Profile title",
                                    description: "mock Profile description",
                                    properties: {
                                        mockProp: {
                                            type: "string",
                                            optionDefinition:  {
                                                name: "mockProp",
                                                aliases: ["m"],
                                                description: "The mockProp description.",
                                                type: "string",
                                                required: true
                                            }
                                        }
                                    }
                                }
                            }
                        ]
                    };
                })
            });

            /* getResolvedCmdTree calls CompleteProfilesGroupBuilder.getProfileGroup,
             * which we need to mock to do nothing.
             */
            const { CompleteProfilesGroupBuilder } = require("../src/profiles/builders/CompleteProfilesGroupBuilder");
            CompleteProfilesGroupBuilder.getProfileGroup = jest.fn();

            const autoGenCmdTree = Imperative.addAutoGeneratedCommands(mockRootCmdTree);
            expect(CompleteProfilesGroupBuilder.getProfileGroup).toHaveBeenCalled();
        });
    });

});

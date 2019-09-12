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

import * as fs from "fs";
import * as path from "path";

import { Constants } from "../../../constants/src/Constants";
import { ImperativeConfig, GuiResult, ProcessUtils } from "../../../utilities";
import { IWebHelpManager } from "./doc/IWebHelpManager";
import { WebHelpGenerator } from "./WebHelpGenerator";
import { IHandlerResponseApi } from "../doc/response/api/handler/IHandlerResponseApi";
import { ICommandDefinition } from "../doc/ICommandDefinition";
import { IWebHelpPackageMetadata } from "./doc/IWebHelpPackageMetadata";

/**
 * Type used when comparing package metadata. If it contains metadata, it is
 * new metadata that is different from the old. If it is `null`, then nothing
 * has changed.
 * @type {MaybePackageMetadata}
 */
type MaybePackageMetadata = null | IWebHelpPackageMetadata[];

/**
 * Imperative web help manager. Single instance class used to launch web help
 * in browser which handles (re)building web help files first if necessary.
 * @export
 * @class WebHelpManager
 */
export class WebHelpManager implements IWebHelpManager {
    /**
     * Singleton instance of this class
     * @private
     * @static
     * @type {WebHelpManager}
     * @memberof WebHelpManager
     */
    private static mInstance: WebHelpManager = null;

    /**
     * Imperative command tree to build help for
     * @private
     * @memberof WebHelpManager
     */
    private mFullCommandTree: ICommandDefinition;

    /**
     * Return a singleton instance of this class
     * @static
     * @readonly
     */
    public static get instance(): WebHelpManager {
        if (this.mInstance == null) {
            this.mInstance = new WebHelpManager();
        }

        return this.mInstance;
    }

    /**
     * Launch root help page in browser.
     * @param {IHandlerResponseApi} cmdResponse - Command response object to use for output
     * @returns True if launched successfully
     * @memberof WebHelpManager
     */
    public openRootHelp(cmdResponse: IHandlerResponseApi): boolean {
        return this.openHelp(null, cmdResponse);
    }

    /**
     * Launch help page for specific group/command in browser.
     * @param {string} inContext - Name of page for group/command to jump to
     * @param {IHandlerResponseApi} cmdResponse - Command response object to use for output
     * @returns True if launched successfully
     * @memberof WebHelpManager
     */
    public openHelp(inContext: string, cmdResponse: IHandlerResponseApi): boolean {
        const doWeHaveGui = ProcessUtils.isGuiAvailable();
        if (doWeHaveGui !== GuiResult.GUI_AVAILABLE) {
            let errMsg = "You are running in an environment with no graphical interface." +
                         "\nAlternatively, you can run '" + ImperativeConfig.instance.findPackageBinName() +
                         " --help' for text-based help.";
            if (doWeHaveGui === GuiResult.NO_GUI_NO_DISPLAY) {
                errMsg += "\n\nIf you are running in an X Window environment," +
                          "\nensure that your DISPLAY environment variable is set." +
                          "\nFor example, type the following:" +
                          "\n    echo $DISPLAY" +
                          "\nIf it is not set, assign a valid value. For example:" +
                          "\n    export DISPLAY=:0.0" +
                          "\nThen try the --help-web option again.";
            }
            cmdResponse.console.error(errMsg);
            return false;
        }

        const newMetadata: MaybePackageMetadata = this.checkIfMetadataChanged();
        if (newMetadata !== null) {
            (new WebHelpGenerator(this.mFullCommandTree, ImperativeConfig.instance, this.webHelpDir)).
                 buildHelp(cmdResponse);
            this.writePackageMetadata(newMetadata);
        }

        cmdResponse.console.log("Launching web help in browser...");

        /* Update cmdToLoad value in tree-data.js to jump to desired command.
        * This is kind of a hack, necessitated by the fact that unfortunately
        * Windows does not natively support passing URL search params to
        * file:/// links. Therefore the `p` parameter supported by the docs
        * site to load a page in-context cannot be used here.
        */
        const treeDataPath = path.join(this.webHelpDir, "tree-data.js");
        const treeDataContent = fs.readFileSync(treeDataPath).toString();
        const cmdToLoad = inContext ? `"${inContext}"` : "null";
        fs.writeFileSync(treeDataPath,
            treeDataContent.replace(/(const cmdToLoad)[^;]*;/, `$1 = ${cmdToLoad};`));

        try {
            const openerProc = require("opener")("file:///" + this.webHelpDir + "/index.html");

            if (process.platform !== "win32") {
                /* On linux, without the following statements, the zowe
                * command does not return until the browser is closed.
                * Mac is untested, but for now we treat it like linux.
                */
                openerProc.unref();
                openerProc.stdin.unref();
                openerProc.stdout.unref();
                openerProc.stderr.unref();
            }
        } catch {
            cmdResponse.console.error("Failed to launch web help, try running -h for console help instead");
            return false;
        }

        return true;
    }

    /**
     * Record a reference to our CLI's full command tree.
     * @param fullCommandTree - The command tree.
     */
    public set fullCommandTree(fullCommandTree: ICommandDefinition) {
        this.mFullCommandTree = fullCommandTree;
    }

    /**
     * Get a reference to our CLI's full command tree.
     * @returns The command tree.
     */
    public get fullCommandTree(): ICommandDefinition {
        return this.mFullCommandTree;
    }

    /**
     * Gets the directory where built copy of web help is stored
     * @readonly
     * @private
     * @returns {string} Absolute path of directory
     */
    private get webHelpDir(): string {
        return path.join(ImperativeConfig.instance.cliHome, Constants.WEB_HELP_DIR);
    }

    /**
     * Computes current package metadata based on version of core and installed plug-ins
     * @private
     * @param packageJson - CLI package JSON
     * @param pluginsJson - Imperative plug-ins JSON
     * @returns {IWebHelpPackageMetadata[]} Names and versions of all components
     */
    private calcPackageMetadata(packageJson: any, pluginsJson: any): IWebHelpPackageMetadata[] {
        return [
            { name: packageJson.name, version: packageJson.version },
            ...Object.keys(pluginsJson).map((name: any) => {
                return { name, version: pluginsJson[name].version };
            })
        ];
    }

    /**
     * Compares two package metadata objects to see if they are equal
     * @private
     * @param {IWebHelpPackageMetadata[]} cached - Old cached package metadata
     * @param {IWebHelpPackageMetadata[]} current - Freshly computed package metadata
     * @returns {boolean} True if the package metadata objects are equal
     */
    private eqPackageMetadata(cached: IWebHelpPackageMetadata[], current: IWebHelpPackageMetadata[]): boolean {
        return JSON.stringify(cached.sort((a, b) => a.name.localeCompare(b.name))) ===
            JSON.stringify(current.sort((a, b) => a.name.localeCompare(b.name)));
    }

    /**
     * Checks if cached package metadata is non-existent or out of date
     * @private
     * @returns {MaybePackageMetadata} Updated metadata, or `null` if cached metadata is already up to date
     */
    private checkIfMetadataChanged(): MaybePackageMetadata {
        // Load cached metadata from file if it exists
        const metadataFile = path.join(this.webHelpDir, "metadata.json");
        let cachedMetadata: IWebHelpPackageMetadata[] = [];
        if (fs.existsSync(metadataFile)) {
            cachedMetadata = require(metadataFile);
        }

        // Compute current metadata and compare it to cached
        const myConfig: ImperativeConfig = ImperativeConfig.instance;
        const currentMetadata: IWebHelpPackageMetadata[] = this.calcPackageMetadata(myConfig.callerPackageJson,
            require(path.join(myConfig.cliHome, "plugins", "plugins.json")));

        const metadataChanged: boolean = !this.eqPackageMetadata(cachedMetadata, currentMetadata);
        return metadataChanged ? currentMetadata : null;
    }

    /**
     * Updates cached package metadata
     * @private
     * @param {IWebHelpPackageMetadata[]} metadata - New metadata to save to disk
     */
    private writePackageMetadata(metadata: IWebHelpPackageMetadata[]) {
        const metadataFile = path.join(this.webHelpDir, "metadata.json");
        fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    }
}

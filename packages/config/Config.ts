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

import { CredentialManagerFactory } from "../security";
import { IConfigParams } from "./IConfigParams";
import { IConfigApi } from "./IConfigApi";
import * as fs from "fs";
import * as path from "path";
import { IConfig } from "./IConfig";
import { IConfigLayer } from "./IConfigLayer";
import { ImperativeError } from "../error";
import * as deepmerge from "deepmerge";

interface ICnfg {
    app: string;
    paths?: string[];
    exists?: boolean;
    config?: IConfig;
    base?: IConfig;
    api?: IConfigApi;
    layers?: IConfigLayer[];
    schemas?: any;
    home?: string;
    name?: string;
    user?: string;
    active?: {
        user: boolean;
        global: boolean;
    };
};

enum layers {
    project_user = 0,
    project_config,
    global_user,
    global_config
};

export class Config {
    private static readonly LAYERS = layers.global_config;
    private static readonly LAYER_GROUP_PROJECT = [layers.project_user, layers.project_config];
    private static readonly LAYER_GROUP_GLOBAL = [layers.global_user, layers.global_config];

    private static readonly IDENT: number = 4;

    private constructor(private _: ICnfg) { }

    public static load(app: string, opts?: IConfigParams): Config {
        const _: ICnfg = { ...opts, app }; // copy the parameters

        ////////////////////////////////////////////////////////////////////////
        // Create the basic empty configuration
        (_ as any).config = {};
        _.config.profiles = {};
        _.config.defaults = {};
        _.config.all = {};
        _.config.plugins = [];
        _.layers = [];
        _.schemas = _.schemas || {};
        _.home = _.home || path.join(require("os").homedir(), `.${app}`);
        _.paths = [];
        _.name = `${app}.config.json`;
        _.user = `${app}.config.user.json`;
        _.active = { user: false, global: false };
        (_ as any).api = {};

        ////////////////////////////////////////////////////////////////////////
        // Populate configuration file layers
        const home = require('os').homedir();
        const properties: IConfig = {
            secure: {},
            profiles: {},
            defaults: {},
            all: {},
            plugins: []
        };

        // Find/create project user layer
        let user = Config.search(_.user, { stop: home });
        if (user == null)
            user = path.join(process.cwd(), _.user);
        _.paths.push(user);
        _.layers.push({ path: user, exists: false, properties, global: false, user: true });

        // Find/create project layer
        let project = Config.search(_.name, { stop: home });
        if (project == null)
            project = path.join(process.cwd(), _.name);
        _.paths.push(project);
        _.layers.push({ path: project, exists: false, properties, global: false, user: false });

        // create the user layer
        const usrGlbl = path.join(_.home, _.user);
        _.paths.push(usrGlbl);
        _.layers.push({ path: usrGlbl, exists: false, properties, global: true, user: true });

        // create the global layer
        const glbl = path.join(_.home, _.name);
        _.paths.push(glbl);
        _.layers.push({ path: glbl, exists: false, properties, global: true, user: false });

        ////////////////////////////////////////////////////////////////////////
        // Create the config and setup the APIs
        const config = new Config(_);

        // setup the API for profiles
        config.properties.profiles = {
            get: config.api_profiles_get.bind(config),
            loadSecure: config.api_profiles_load_secure.bind(config),
            names: config.api_profiles_names.bind(config),
            exists: config.api_profiles_exists.bind(config),
            set: config.api_profiles_set.bind(config)
        };

        // setup the API for plugins
        config.properties.plugins = {
            new: config.api_plugins_new.bind(config)
        };

        ////////////////////////////////////////////////////////////////////////
        // Read and populate each configuration layer
        try {
            let setActive = true;
            config._.layers.forEach((layer: IConfigLayer) => {
                // Attempt to popluate the layer
                if (fs.existsSync(layer.path)) {
                    try {
                        layer.properties = JSON.parse(fs.readFileSync(layer.path).toString());
                        layer.exists = true;
                        config._.exists = true;
                    } catch (e) {
                        throw new ImperativeError({ msg: `${layer.path}: ${e.message}` });
                    }
                }

                // Find the active layer
                if (setActive && layer.exists) {
                    _.active.user = layer.user;
                    _.active.global = layer.global;
                    setActive = false;
                }

                // Populate any undefined defaults
                layer.properties.defaults = layer.properties.defaults || {};
                layer.properties.profiles = layer.properties.profiles || {};
                layer.properties.all = layer.properties.all || {};
                layer.properties.secure = layer.properties.secure || [];
                layer.properties.plugins = layer.properties.plugins || [];
            });
        } catch (e) {
            throw new ImperativeError({ msg: `error reading config file: ${e.message}` });
        }

        ////////////////////////////////////////////////////////////////////////
        // Merge the configuration layers
        config.layerMerge();

        ////////////////////////////////////////////////////////////////////////
        // Complete - retain the "base" aka original configuration
        config._.base = JSON.parse(JSON.stringify(config._.config));
        return config;
    }

    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    // Plugins APIs
    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    private api_plugins_write(): void {
        try {
            const layer = this.layerActive();
            if (layer.exists) {
                const c = JSON.parse(JSON.stringify(layer.properties));
                c.plugins = c.plugins.concat(this.api_plugins_new());
                try {
                    fs.writeFileSync(layer.path, JSON.stringify(c, null, Config.IDENT))
                } catch (e) {
                    throw new ImperativeError({ msg: `${layer.path}: ${e.message}` });
                }
            }
        } catch (e) {
            throw new ImperativeError({ msg: `write plugins failed: ${e.message}` });
        }
    }

    private api_plugins_new(): string[] {
        const base = this._.base.plugins;
        return this._.config.plugins.filter((plugin: string) => {
            return base.indexOf(plugin) < 0
        });
    }

    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    // Profile APIs
    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    private async api_profiles_load_secure() {
        // If the secure option is set - load the secure values for the profiles
        if (CredentialManagerFactory.initialized) {

            // If we have fields that are indicated as secure, then we will load
            // and populate the values in the configuration
            if (this._.config.secure.length > 0) {
                for (const layer of this._.layers) {
                    if (layer.properties.secure.length > 0) {
                        for (const property of layer.properties.secure) {

                            // Load the secure field
                            const value = await CredentialManagerFactory.manager.load(
                                Config.secureKey(layer.path, property), true);

                            // traverse the object and set the properties
                            let obj: any = layer.properties;
                            const segments = property.split(".");
                            const n = segments.length;
                            for (let x = 0; x < n; x++) {
                                if (obj[segments[x]] == null)
                                    break;
                                if (x === n - 1) {
                                    obj[segments[x]] = JSON.parse(value);
                                    break;
                                }
                                obj = obj[segments[x]];
                            }
                        }
                    }
                }
            }
        }


        // merge into config
        this.layerMerge();
    }

    private api_profiles_names(): string[] {
        return Object.keys(this._.config.profiles);
    }

    private api_profiles_exists(type: string, name: string): boolean {
        return this._.config.profiles[type] != null && this._.config.profiles[type][name] != null;
    }

    private api_profiles_get(type: string, name: string): any {
        if (!this.api_profiles_exists(type, name))
            return null;

        // Locate the profile and merge with "all"
        let all: any = {};
        let profile: any = {};
        for (let x = 0; x < Config.LAYERS; x++) {
            if (this._.layers[x].properties.profiles[type] != null &&
                this._.layers[x].properties.profiles[type][name] != null) {
                profile = this._.layers[x].properties.profiles[type][name];

                // Merge the user/config all of the project/global layer
                const i = (x + 1 % 2 === 0) ? x - 1 : x + 2;
                const all1 = JSON.parse(JSON.stringify(this._.layers[x].properties.all));
                const all2 = JSON.parse(JSON.stringify(this._.layers[i].properties.all));
                all = deepmerge(all2, all1);
                break;
            }
        }

        // Merge the profile with the additional properties
        return { ...all, ...profile };
    }

    private api_profiles_set(type: string, name: string, contents: { [key: string]: any }, opts?: { secure: string[] }) {
        const layer = this.layerActive();
        if (layer.properties.profiles[type] == null)
            layer.properties.profiles[type] = {};

        layer.properties.profiles[type][name] = contents;
        if (opts != null && opts.secure) {
            opts.secure.forEach((secure: string) => {
                layer.properties.secure = Array.from(new Set(layer.properties.secure.concat([`profiles.${name}.${secure}`])));
            });
        }
        this.layerMerge();
    }

    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    // Accessors
    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    public get api(): IConfigApi {
        return this._.api;
    }

    public get exists(): boolean {
        return this._.exists;
    }

    public get paths(): string[] {
        return this._.paths;
    }

    public get base(): IConfig {
        return JSON.parse(JSON.stringify(this._.base));
    }

    public get layers(): IConfigLayer[] {
        return JSON.parse(JSON.stringify(this._.layers));
    }

    public get properties(): IConfig {
        return JSON.parse(JSON.stringify(this._.config));
    }

    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    // Manipulate config properties
    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    public set(property: string, value: any, opts?: { secure?: boolean, append?: boolean }) {
        opts = opts || {};

        // TODO: additional validations
        if (property.startsWith("group") && !Array.isArray(value))
            throw new ImperativeError({ msg: `group property must be an array` });

        // TODO: make a copy and validate that the update would be legit
        // TODO: based on schema
        const layer = this.layerActive();
        let obj: any = layer.properties;
        const segments = property.split(".");
        property.split(".").forEach((segment: string) => {
            if (obj[segment] == null && segments.indexOf(segment) < segments.length - 1) {
                obj[segment] = {};
                obj = obj[segment];
            } else if (segments.indexOf(segment) === segments.length - 1) {

                // TODO: add ability to escape these values to string
                if (value === "true")
                    value = true;
                if (value === "false")
                    value = false;
                if (!isNaN(value) && !isNaN(parseFloat(value)))
                    value = parseInt(value, 10);
                if (opts.append) {
                    if (!Array.isArray(obj[segment]))
                        throw new ImperativeError({ msg: `property ${property} is not an array` });
                    obj[segment].push(value);
                } else {
                    obj[segment] = value;
                }
            } else {
                obj = obj[segment];
            }
        });

        if (opts.secure)
            layer.properties.secure = Array.from(new Set(layer.properties.secure.concat([property])));

        this.layerMerge();
    }

    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    // Utilities
    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    public static search(file: string, opts?: any): string {
        opts = opts || {};
        if (opts.stop) opts.stop = path.resolve(opts.stop);
        let p = path.join(process.cwd(), file);
        const root = path.parse(process.cwd()).root;
        let prev = null;
        do {
            // this should never happen, but we'll add a check to prevent
            if (prev != null && prev === p)
                throw new ImperativeError({ msg: `internal search error: prev === p (${prev})` });
            if (fs.existsSync(p))
                return p;
            prev = p;
            p = path.resolve(path.dirname(p), "..", file);
        } while (p !== path.join(root, file) && opts.stop != null && path.dirname(p) !== opts.stop)
        return null;
    }

    private static secureKey(cnfg: string, property: string): string {
        return cnfg + "_" + property;
    }

    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    // Layer APIs
    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    public async layerWrite(): Promise<any> {
        const layer: IConfigLayer = JSON.parse(JSON.stringify(this.layerActive()));

        // If the credential manager factory is initialized then we must iterate
        // through the profiles and securely store the values
        if (CredentialManagerFactory.initialized) {
            if (layer.properties.secure.length > 0) {
                for (const property of layer.properties.secure) {
                    let value: any = layer.properties
                    const segments = property.split(".");
                    const n = segments.length;
                    let x = 0;
                    let store = null;
                    for (x = 0; x < n; x++) {
                        if (value[segments[x]] == null)
                            break;
                        if (x === n - 1) {
                            store = value[segments[x]];
                            value[segments[x]] = `managed by ${CredentialManagerFactory.manager.name}`;
                        }
                        value = value[segments[x]];
                    }
                    if (store != null) {
                        const save = JSON.stringify(store);
                        await CredentialManagerFactory.manager.save(Config.secureKey(layer.path, property), save);
                    }
                }
            }
        }

        // Write the layer
        try {
            fs.writeFileSync(layer.path, JSON.stringify(layer.properties, null, 4));
        } catch (e) {
            throw new ImperativeError({ msg: `error writing "${layer.path}": ${e.message}` });
        }
        layer.exists = true;
    }

    public layerActivate(user: boolean, global: boolean) {
        this._.active.user = user;
        this._.active.global = global;
    }

    public layerGet(): IConfigLayer {
        return JSON.parse(JSON.stringify(this.layerActive()));
    }

    public layerSet(config: IConfig) {
        for (const i in this._.layers) {
            if (this._.layers[i].user === this._.active.user && this._.layers[i].global === this._.active.global) {
                this._.layers[i].properties = config;
                this._.layers[i].properties.defaults = this._.layers[i].properties.defaults || {};
                this._.layers[i].properties.profiles = this._.layers[i].properties.profiles || {};
                this._.layers[i].properties.all = this._.layers[i].properties.all || {};
                this._.layers[i].properties.plugins = this._.layers[i].properties.plugins || [];
                this._.layers[i].properties.secure = this._.layers[i].properties.secure || [];
            }
        }
        this.layerMerge();
    }

    private layerMerge() {
        // clear the config as it currently stands
        this._.config.all = {};
        this._.config.defaults = {};
        this._.config.profiles = {};
        this._.config.plugins = [];
        this._.config.secure = [];

        // merge each layer
        this._.layers.forEach((layer: IConfigLayer) => {
            // merge "secure" - create a unique set from all entires
            this._.config.secure = Array.from(new Set(layer.properties.secure.concat(this._.config.secure)));

            // Merge "plugins" - create a unique set from all entires
            this._.config.plugins = Array.from(new Set(layer.properties.plugins.concat(this._.config.plugins)));

            // Merge "defaults" - only add new properties from this layer
            for (const [name, value] of Object.entries(layer.properties.defaults)) {
                this._.config.defaults[name] = this._.config.defaults[name] || value;
            }

            // Merge "all" - only add new properties from this layer
            for (const [name, value] of Object.entries(layer.properties.all)) {
                this._.config.all[name] = this._.config.all[name] || value;
            }
        });

        // Merge the project layer profiles together
        const usrProject = this._.layers[layers.project_user].properties.profiles;
        const project = this._.layers[layers.project_config].properties.profiles;
        const p = deepmerge(project, usrProject);

        // Merge the global layer profiles together
        const usrGlobal = this._.layers[layers.global_user].properties.profiles;
        const global = this._.layers[layers.global_config].properties.profiles;
        const g = deepmerge(global, usrGlobal);

        // merge both project and global layers to create
        const all: any = p;
        for (const [type, profiles] of Object.entries(g)) {
            if (all[type] == null)
                all[type] = profiles;
            else {
                for (const [name, profile] of Object.entries(all[type])) {
                    all[type][name] = all[type][name] || profile;
                }
            }
        }

        // Set them in the config
        this._.config.profiles = all;
    }

    private layerActive(): IConfigLayer {
        for (const layer of this._.layers) {
            if (layer.user === this._.active.user && layer.global === this._.active.global)
                return layer;
        }
        throw new ImperativeError({ msg: `internal error: no active layer found` });
    }
}
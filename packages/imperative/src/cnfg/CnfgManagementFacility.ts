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

import { PerfTiming } from "@zowe/perf-timing";
import { UpdateImpConfig } from "../UpdateImpConfig";
import { Logger } from "../../../logger";
import { pathsDefinition } from "./cmd/list/paths/paths.definition";
import { listDefinition } from "./cmd/list/list.definition";

export class CnfgManagementFacility {
    private static mInstance: CnfgManagementFacility;

    /**
     * Used for internal imperative logging.
     *
     * @private
     * @type {Logger}
     */
    private impLogger: Logger = Logger.getImperativeLogger();

    /**
     * Gets a single instance of the CMF. On the first call of
     * CnfgManagementFacility.instance, a new CMF is initialized and returned.
     * Every subsequent call will use the one that was first created.
     *
     * @returns {CnfgManagementFacility} - The newly initialized CMF object.
     */
    public static get instance(): CnfgManagementFacility {
        if (this.mInstance == null) {
            this.mInstance = new CnfgManagementFacility();
        }

        return this.mInstance;
    }

    /**
     * Initialize the CMF. Must be called to enable the various commands provided
     * by the facility.
     */
    public init(): void {

        const timingApi = PerfTiming.api;

        if (PerfTiming.isEnabled) {
            // Marks point START
            timingApi.mark("START_CNFG_INIT");
        }

        this.impLogger.debug("CnfgManagementFacility.init() - Start");

        // Add the config group and related commands.
        UpdateImpConfig.addCmdGrp({
            name: "cnfg",
            type: "group",
            summary: "Manage JSON project and global configuration",
            description: "Manage JSON project and global configuration",
            children: [
                listDefinition,
            ]
        });

        this.impLogger.debug("CnfgManagementFacility.init() - Success");

        if (PerfTiming.isEnabled) {
            // Marks point END
            timingApi.mark("END_CNFG_INIT");
            timingApi.measure("ConfigManagementFacility.init()", "START_CNFG_INIT", "END_CNFG_INIT");
        }
    }
}
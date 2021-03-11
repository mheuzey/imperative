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

import { IConfigVault } from "./IConfigVault";

export interface IConfigOpts {
    /**
     * Directory where global config files are located. Defaults to `~/.appName`.
     */
    homeDir?: string;

    /**
     * Directory where project config files are located. Defaults to working directory.
     */
    projectDir?: string;

    /**
     * Vault object with methods for loading and saving secure credentials
     */
    vault?: IConfigVault;
}

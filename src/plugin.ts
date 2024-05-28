/// <reference path="../lib/openrct2.d.ts" />

import { startup } from "./startup";

registerPlugin({
	name: "Configurable Objective Setter",
	version: "0.0.0",
	authors: [ "Loggy" ],
	type: "remote",
	licence: "MIT",
	targetApiVersion: 84,
	main: startup,
});
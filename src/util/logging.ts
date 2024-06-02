type LogTypes = "IndividualSim" | "SimManagerIterations" | "Warning" | "Error" | "StrategySwitchPoint" | "AllSuccessfulSims" | "Info";

export const ActiveLogTypes: Record<LogTypes, boolean> = {
    "Warning":true,
    "Error":true,
    "Info":true,
    "IndividualSim":false,          // Extra individual sim outputs
    "SimManagerIterations":false,   // Potential infinite loops in the sim manager
    "StrategySwitchPoint":false,     // Info on what the optimal switch point finder is doing
    "AllSuccessfulSims":false,      // Output the activity log of every viable sim, gets very spammy
}

export function log(message: string, type: LogTypes)
{
    if (ActiveLogTypes[type])
    {
        console.log(`${type}: ${message}`);
    }
}
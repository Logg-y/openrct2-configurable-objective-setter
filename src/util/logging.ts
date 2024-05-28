type LogTypes = "IndividualSim" | "SimManagerIterations" | "Warning";

const ActiveLogTypes: Record<LogTypes, boolean> = {
    "IndividualSim":false,
    "SimManagerIterations":false,
    "Warning":true,
}

export function log(message: string, type: LogTypes)
{
    if (ActiveLogTypes[type])
    {
        console.log(`${type}: ${message}`);
    }
}
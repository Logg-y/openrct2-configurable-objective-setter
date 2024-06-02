// If anyone ever wanted to localise this, most of the important userfacing text is a property of an object
// that could be switched out on the fly

export function formatTokens(template: string, ...replacements: string[])
{
    for (let i=0; i<replacements.length; i++)
    {
        let token = `{${i}}`;
        template = template.replace(token, replacements[i]);
    }
    return template;
}

export const StringTable =
{
    PLUGIN_MENU_ITEM: "Configurable Objective Setter",

    OK: "OK",
    CANCEL: "Cancel",
    ERROR: "Error",
    RUN: "Run",

    UI_ERROR_RANDOMISATION_ALREADY_STARTED: "Run already begun. If nothing is happening, you may need to restart the scenario.",
    UI_VALUE_NOT_NUMERIC: "Entered value was not numeric.",

    UI_ENTER_VALUE: "Enter Value...",
    UI_ENTER_NUMERIC_VALUE_PROMPT: "Enter a new numeric value for this setting:",
    UI_MAX: "Maximum",

    OBJECTIVE_FAILED_MESSAGE: "{RED}You have failed to complete your objective within the time limit!",


    // Main tab
    UI_MAIN_SETTINGS: "{PALEGOLD}Main Settings",
    UI_GUEST_DIFFICULTY: "Difficulty: ",
    UI_GUEST_DIFFICULTY_TOOLTIP: "What percentage of the estimated theoretical maximum possible number of guests is required to beat the scenario.",
    UI_GUEST_DIFFICULTY_EXTHELP: "The randomiser tries to simulate playing through the scenario while building{NEWLINE}a relatively 'normal' park.{NEWLINE}This setting is the percentage of guest spawns that{NEWLINE}the simulation gets.{NEWLINE}{NEWLINE}Because guests and income are closely connected, a higher{NEWLINE}setting will both require you to attract guests more{NEWLINE}efficiently (keep ahead of soft guest cap) and will also be tighter on cash.",
    UI_GUEST_DIFFICULTY_EXTHELP2: "The simulation will try to make use of what is available.{NEWLINE}{NEWLINE}This includes running advertising, and rushing to research the money{NEWLINE}generating cash machine in pay-per-ride parks. This setting does also{NEWLINE}reduce the amount of guests that the simulation will get from advertising.",

    UI_CASH_TIGHTNESS: "Financial Difficulty: ",
    UI_CASH_TIGHTNESS_TOOLTIP: "Financial pressures will be increased until the average amount of cash the simulation has on hand at the end of every month is about this value.",

    UI_STARTING_CASH: "Starting Cash: ",
    UI_STARTING_CASH_TOOLTIP: "The amount of cash you start the game with, if you max your loan.",

    UI_SCENARIO_LENGTH: "Scenario Length (years): ",
    UI_SCENARIO_LENGTH_TOOLTIP: "The objective time limit in years.",

    UI_PAY_PER_RIDE_CHANCE: "Pay per ride chance: ",
    UI_PAY_PER_RIDE_TOOLTIP: "The chance (percentage) that the park is pay per ride. Otherwise, it is pay for entry.",

    // Objectives and restrictions
    UI_OBJECTIVE_RESTRICTION_SETTINGS: "{PALEGOLD}Objective and Restriction Settings",

    UI_OBJECTIVE_WEIGHTS: "Objective Weights",

    UI_OBJECTIVE_WEIGHT_GUESTS: "Guests by date: ",
    UI_OBJECTIVE_WEIGHT_GUESTS_TOOLTIP: "The weight of guests by date objectives. The ratio of this and the repay loan objective determines the chance of each type.",

    UI_OBJECTIVE_WEIGHT_REPAY_LOAN: "Repay loan by date: ",
    UI_OBJECTIVE_WEIGHT_REPAY_LOAN_TOOLTIP: "The weight of repay loan objectives. The ratio of this and the guests by time objective determines the chance of each type. Unlike the vanilla objective, there is a time limit for this objective.",

    UI_OBJECTIVE_REPAY_LOAN_FORCE_PAY_PER_RIDE: "Repay loan forces pay per ride",
    UI_OBJECTIVE_REPAY_LOAN_FORCE_PAY_PER_RIDE_TOOLTIP: "This objective with pay for entry seems a bit boring as optimal play is to optimise guest turnover, build enough of a park that guest count becomes stable and just stop playing the game.",

    UI_OBJECTIVE_REPAY_LOAN_REQUIREMENTS: "Repay loan cash machine condition: ",
    UI_OBJECTIVE_REPAY_LOAN_REQUIREMENTS_TOOLTIP: "This objective without a cash machine seems a bit boring as optimal play is to stop expanding and simply optimise guest turnover.",

    UI_OBJECTIVE_REPAY_LOAN_CASH_MACHINE_DEFAULT: "Scenario default",
    UI_OBJECTIVE_REPAY_LOAN_CASH_MACHINE_ALWAYS: "Always give immediately",
    UI_OBJECTIVE_REPAY_LOAN_CASH_MACHINE_IF_UNRESEARCHABLE: "Give immediately if unresearchable",


    UI_RESTRICTIONS: "Restrictions",

    UI_RESTRICTIONS_ADVERTISING: "Forbid advertising chance: ",
    UI_RESTRICTIONS_ADVERTISING_TOOLTIP: "The percentage chance of advertising campaigns being forbidden.",

    UI_RESTRICTIONS_HARDER_GUEST_GENERATION: "Harder guest generation chance: ",
    UI_RESTRICTIONS_HARDER_GUEST_GENERATION_TOOLTIP: "The percentage chance of hard guest generation being enabled.",

    UI_RESTRICTIONS_HARDER_PARK_RATING: "Harder park rating chance: ",
    UI_RESTRICTIONS_HARDER_PARK_RATING_TOOLTIP: "The percentage chance of park rating being 100 lower than normal.",

    UI_RESTRICTIONS_HIGH_CONSTRUCTION: "Forbid high construction chance: ",
    UI_RESTRICTIONS_HIGH_CONSTRUCTION_TOOLTIP: "The percentage chance of construction above tree height being forbidden.",

    UI_RESTRICTIONS_TREE_REMOVAL: "Forbid tree removal chance: ",
    UI_RESTRICTIONS_TREE_REMOVAL_TOOLTIP: "The percentage chance of tree removal being forbidden.",

    UI_RESTRICTIONS_LANDSCAPE: "Forbid land modification chance: ",
    UI_RESTRICTIONS_LANDSCAPE_TOOLTIP: "The percentage chance of landscape changes being forbidden.",

    // Land settings
    UI_LAND_SETTINGS: "{PALEGOLD}Land Settings",

    UI_LAND_TILES_PER_100_SGC: "Tiles per 100 soft guest cap: ",
    UI_LAND_TILES_PER_100_SGC_TOOLTIP: "How many tiles of rides/path etc you expect to build to get 100 soft guest cap.",
    UI_LAND_TILES_PER_100_SGC_EXTHELP: "This determines how dense a park you will be expected to build. The{NEWLINE}measurement is how many tiles are needed for 100 soft guest cap.{NEWLINE}This is further adjusted if factors like harder guest generation or forbidden{NEWLINE}high construction are enabled.{NEWLINE}{NEWLINE}The simulation isn't allowed to increase soft guest cap beyond{NEWLINE}how much space is available. 'Expand buyable land' will increase this{NEWLINE}dramatically, potentially allowing it to cover the entire map.",

    UI_LAND_TILES_PER_100_SGC_HARD_GUEST_GEN: "Tiles per 100 soft guest cap (harder guest generation): ",
    UI_LAND_TILES_PER_100_SGC_HARD_GUEST_GEN_TOOLTIP: "The amount of space needed per 100 soft guest cap in harder guest generation parks when the guest count is over 1000.",
    UI_LAND_TILES_PER_100_SGC_HARD_GUEST_GEN_EXTHELP: context.formatString("Harder guest generation causes rides to stop contributing soft guest cap at{NEWLINE}1000, unless they have an excitement of 6.0 or above and a ride length{NEWLINE}of {LENGTH}, but rides meeting these requirements count double{NEWLINE}for soft guest cap.{NEWLINE}{NEWLINE}This value is how many tiles are needed to get 100 soft guest cap{NEWLINE}with these rides.", 600),


    UI_LAND_MAKE_BUYABLE: "Expand buyable land",
    UI_LAND_MAKE_BUYABLE_TOOLTIP: "Whether or not normally unbuyable land could be made buyable to give you more space to build in.",

    UI_LAND_SHRINK_SPACE: "Remove unneeded playable land",
    UI_LAND_SHRINK_SPACE_TOOLTIP: "This option will remove buyable/owned land that the simulation did not need in order to complete the scenario. If this scenario has more than one entrance, making sure that they are joined by path/rides might be needed to ensure they can still connect to each other.",

    UI_LAND_PARK_ENTRANCE_PROTECTION_RADIUS: "Park entrance protection radius: ",
    UI_LAND_PARK_ENTRANCE_PROTECTION_RADIUS_TOOLTIP: "Owned or buyable tiles within this distance of a park entrance cannot have their ownership states changed.",

    UI_LAND_PARK_FEATURE_PROTECTION_RADIUS: "Path/ride protection radius: ",
    UI_LAND_PARK_FEATURE_PROTECTION_RADIUS_TOOLTIP: "Owned tiles inside the park within this distance of a piece of currently existing path or ride cannot have their ownership states changed.",

    // Financial settings
    UI_FINANCIAL_SETTINGS: "{PALEGOLD}Financial Pressure Settings",

    UI_FINANCIAL_MINIMUM_LOAN_INTEREST: "Min loan interest: ",
    UI_FINANCIAL_MINIMUM_LOAN_INTEREST_TOOLTIP: "Loan interest will be forced to always be higher than this value. A high value of loan interest can be interesting as it adds a choice between building more park and paying off loan.",

    UI_FINANCIAL_SCENARIO_INTEREST: "Scenario's base interest (for RCT1 scenarios use 1.37): ",
    UI_FINANCIAL_SCENARIO_INTEREST_TOOLTIP: "The plugin API cannot access a scenario's base interest so I have to ask for it. For scenarios using RCT1 interest calculation, this should be set to ~1.37.",

    UI_FINANCIAL_DIFFICULTY_METHODS_MIN: "Min number of financial pressures: ",
    UI_FINANCIAL_DIFFICULTY_METHODS_MIN_TOOLTIP: "The minimum number of ways the randomiser will try to increase financial difficulty. Lower values will be more one dimensional.",

    UI_FINANCIAL_DIFFICULTY_METHODS_MAX: "Max number of financial pressures: ",
    UI_FINANCIAL_DIFFICULTY_METHODS_MAX_TOOLTIP: "The maximum number of ways the randomiser will want try to use to increase financial difficulty.",

    UI_FINANCIAL_DIFFICULTIES: "Financial Pressures",

    UI_FINANCIAL_DIFFICULTY_GUEST_STARTING_CASH: "Adjust guest starting cash",
    UI_FINANCIAL_DIFFICULTY_GUEST_STARTING_CASH_TOOLTIP: "Guest starting cash can be adjusted (probably reduced) to change the scenario difficulty. Due to limitations this is implemented via plugin and so other plugins (eg Price Manager's park entry fee management) will not see the updated value.",

    UI_FINANCIAL_DIFFICULTY_LOAN_INTEREST: "Adjust loan interest rate",
    UI_FINANCIAL_DIFFICULTY_LOAN_INTEREST_TOOLTIP: "Loan interest rate can be adjusted (probably increased) to change the scenario difficulty. Due to limitations this is implemented via plugin and the true value will not be displayed in the finances window.",

    UI_FINANCIAL_DIFFICULTY_FORCE_BUY_LAND: "Force buying land to expand",
    UI_FINANCIAL_DIFFICULTY_FORCE_BUY_LAND_TOOLTIP: "Makes some normally-owned land into buyable land. This means that you must buy land to expand the park. This also might make the land cost more.",

    UI_FINANCIAL_DIFFICULTY_START_DEBT: "Adjust starting debt",
    UI_FINANCIAL_DIFFICULTY_START_DEBT_TOOLTIP: "The amount of starting debt (loan that you can't afford to pay back) can be increased, which will leave you at the mercy of loan interest for longer.",


    // Guest settings
    UI_GUEST_SETTINGS: "{PALEGOLD}Guest Settings",

    UI_GUEST_INTENSITY_PREFERENCES: "Intensity Preference Weights",

    UI_GUEST_INTENSITY_NO_PREFERENCE: "No prefence weight: ",
    UI_GUEST_INTENSITY_NO_PREFERENCE_TOOLTIP: "The relative chance for guests to have standard intensity preferences.",

    UI_GUEST_INTENSITY_HIGH: "High intensity preference weight: ",
    UI_GUEST_INTENSITY_HIGH_TOOLTIP: "The relative chance for guests to have preference for high intensity.",

    UI_GUEST_INTENSITY_LOW: "Low intensity preference weight: ",
    UI_GUEST_INTENSITY_LOW_TOOLTIP: "The relative chance for guests to have preference for low intensity.",

    UI_GUEST_STARTING_UMBRELLA: "Chance to start with umbrella: ",
    UI_GUEST_STARTING_UMBRELLA_TOOLTIP: "The percentage chance for guests to spawn with an umbrella. This limits the amount of money that can be made during (inconsistent) rainy weather by overcharging for umbrellas. (The simulation does not truly account for the cash made from umbrellas).",

    UI_GUEST_NARROW_INTENSITY: "Chance for narrowed intensity preferences: ",
    UI_GUEST_NARROW_INTENSITY_TOOLTIP: "This (scripted) option makes guests have a very narrow intensity preference, meaning there is more need to build rides with a wider variety of intensities.",
    UI_GUEST_NARROW_INTENSITY_EXTHELP: "Guests will have an intensity preference of a single value.{NEWLINE}This means that a wider variety of intensities will be needed to please guests.{NEWLINE}{NEWLINE}A guess will ride a ride if its intensity is both:{NEWLINE}{NEWLINE}1) Lower than the guest's max intensity + happiness (0 to 2.5){NEWLINE}2) Higher than the guest's min intensity - happiness (0 to 2.5).{NEWLINE}{NEWLINE}Even with this setting on, a guest at full happiness therefore{NEWLINE}has an intensity range of +/- 2.5.",

    // Profiles
    UI_PROFILES: "{PALEGOLD}Profiles",

    UI_PROFILE_1: "Custom Profile 1",
    UI_PROFILE_2: "Custom Profile 2",
    UI_PROFILE_3: "Custom Profile 3",

    SAVE: "Save",
    LOAD: "Load",

    UI_ARE_YOU_SURE_LOAD: "Are you sure you want to load this profile?",
    UI_ARE_YOU_SURE_SAVE: "Are you sure you want to save over this profile data?",

    UI_SIMSETTINGS: "{PALEGOLD}Simulation Settings",
    UI_SIMSETTINGS_TOOLTIP: "This tab changes parameters of the internal difficulty simulation.",

    UI_SIMSETTINGS_MONTHS_PER_TICK: "Months to simulate per tick during randomisation: ",
    UI_SIMSETTINGS_MONTHS_PER_TICK_TOOLTIP: "Higher values make the plugin do more work between each game tick during difficulty analysis. Larger values will start to impact FPS or make OpenRCT2 lock up entirely until the process is complete.",

    UI_SIMSETTINGS_RIDE_INCOME_PER_GUEST: "Expected monthly pay-per-ride profit per guest: ",
    UI_SIMSETTINGS_RIDE_INCOME_PER_GUEST_TOOLTIP: "The expected maximum monthly profit per guest in pay per ride parks.",

    UI_SIMSETTINGS_STALL_INCOME_PER_GUEST: "Expected max monthly stall profit per guest: ",
    UI_SIMSETTINGS_STALL_INCOME_PER_GUEST_TOOLTIP: "The expected maximum monthly profit per guest from food/drinks/toilets.",

    UI_SIMSETTINGS_COST_PER_100_SGC: "Cost per 100 soft guest cap: ",
    UI_SIMSETTINGS_COST_PER_100_SGC_TOOLTIP: "The amount the simulation thinks 100 soft guest cap should cost (or the first 1000 for harder guest generation).",
    UI_SIMSETTINGS_COST_PER_100_SGC_EXTHELP: context.formatString("The 'soft guest cap' is a calculated value for how many guests the rides{NEWLINE}in your park can attract at once.{NEWLINE}If harder guest generation is not enabled, each ride type contributes{NEWLINE}a flat amount, regardless of the size or stats of the design.{NEWLINE}{NEWLINE}This value will vary a lot depending on how you like to play.{NEWLINE}Spamming microcoasters, 1x1 mazes, or efficient flat rides{NEWLINE}will give much lower values, possibly close to {CURRENCY}.{NEWLINE}", 400),

    UI_SIMSETTINGS_COST_PER_100_SGC_HARD: "Cost per 100 soft guest cap (hard guest generation): ",
    UI_SIMSETTINGS_COST_PER_100_SGC_HARD_TOOLTIP: "The amount the simulation thinks 100 soft guest cap should cost beyond the first 1000 with harder guest generation enabled.",

    UI_SIMSETTINGS_PARK_ENTRY_FEE_PER_100_SGC: "Max park entry fee per 100 soft guest cap: ",
    UI_SIMSETTINGS_PARK_ENTRY_FEE_PER_100_SGC_TOOLTIP: "In pay-for-entry parks, the simulation will charge this amount for entry per 100 soft guest cap it has, up to the maximum of the minimum guest starting cash.",

    UI_SIMSETTINGS_RIDE_UPKEEP_PER_100_SGC: "Ride running costs per 100 soft guest cap: ",
    UI_SIMSETTINGS_RIDE_UPKEEP_PER_100_SGC_TOOLTIP: "The monthly running costs the simulation expects from rides/stalls that support 100 soft guest cap.",

    UI_SIMSETTINGS_STAFF_WAGES_PER_100_SGC: "Staff wages per 100 soft guest cap: ",
    UI_SIMSETTINGS_STAFF_WAGES_PER_100_SGC_TOOLTIP: "The monthly wages that the simulation expects from hired staff that support 100 soft guest cap.",

    UI_SIMSETTINGS_FORBID_TREE_REMOVAL_LOSS: "Forbid tree removal: tiles per tree: ",
    UI_SIMSETTINGS_FORBID_TREE_REMOVAL_LOSS_TOOLTIP: "If tree removal is forbidden, how many tiles of space are lost per tree due to awkward unremovable trees making efficient space usage difficult.",

    UI_SIMSETTINGS_FORBID_HIGH_CONSTRUCTION_SGC_MULTIPLIER: "Forbid high construction: land usage multiplier: ",
    UI_SIMSETTINGS_FORBID_HIGH_CONSTRUCTION_SGC_MULTIPLIER_TOOLTIP: "If high construction is forbidden, what to multiply land usage by when calculating how much space the park needs.",

    UI_SIMSETTINGS_GUEST_TURNOVER_MINIMUM: "Minimum monthly guest turnover: ",
    UI_SIMSETTINGS_GUEST_TURNOVER_MINIMUM_TOOLTIP: "The percentage of guests that leave the park every month at times when we are trying to retain guests.",

    UI_SIMSETTINGS_GUEST_TURNOVER_BROKE_GUEST_LEAVE_PROBABILIY: "Pay-per-ride: Chance for broke guests to leave: ",
    UI_SIMSETTINGS_GUEST_TURNOVER_BROKE_GUEST_LEAVE_DELAY_TOOLTIP: "The percentage of broke guests in pay-per-ride parks without cash machine that will leave every month.",

    UI_SIMSETTINGS_GUEST_TURNOVER_MAXIMUM: "Maximum monthly guest turnover: ",
    UI_SIMSETTINGS_GUEST_TURNOVER_MAXIMUM_TOOLTIP: "The percentage of guests that leave the park every month when we are trying to get guests to leave (eg to increase park ticket income).",
    UI_SIMSETTINGS_GUEST_TURNOVER_MAXIMUM_EXTHELP: "The default value is based on closing food stalls only.{NEWLINE}Mechanics abuse or less humane methods can get much higher values than{NEWLINE}this.{NEWLINE}{NEWLINE}This includes things like dropping guests into the void.",


    SCENARIO_DETAILS_FILLER: "{NEWLINE}{NEWLINE}You have until the end of {MONTHYEAR} to complete your objective. Check the Configurable Objective Setter window to see more.",

    UI_WORKING: "{PALEGOLD}Working...",
    UI_WORKING_UNPAUSE: "The game must be UNPAUSED for this to progress.",
    UI_WORKING_STAGE_PROGRESS: "Stage progress: ",
    UI_WORKING_DIFFICULTYSIM_DIFFERENCE: "Trying to match requested average cash on hand;{NEWLINE}current is over by: ",
    UI_WORKING_DIFFICULTYSIM_NO_VALID: "Trying to find completable settings...",

    RANDOMISER_STATE_NOT_STARTED: "Not started.",
    RANDOMISER_STATE_WAITING_ENGINE_VALUES: "Waiting for engine calculated values...",
    RANDOMISER_STATE_MAP_ANALYSIS: "Basic map analysis...",
    RANDOMISER_STATE_LANDOWNERSHIP_ANALYSIS: "Looking for land that might change ownership...",
    RANDOMISER_STATE_DIFFICULTYSIM: "Adjusting difficulty...",
    RANDOMISER_STATE_LANDOWNERSHIP_ASSIGNMENT: "Assigning land ownership...",
    RANDOMISER_STATE_PARK_FENCE_REMOVAL: "Removing park fence...",
    RANDOMISER_STATE_PARK_FENCE_RECONSTRUCTION: "Reconstructing park fence...",
    RANDOMISER_STATE_FINALISING: "Finalising...",
    RANDOMISER_STATE_SCENARIO_IN_PROGRESS: "Scenario in progress!",
    RANDOMISER_STATE_FAILED: "Found no way to make a completable scenario with given settings.",
    RANDOMISER_STATE_RUINED: "Ruined: don't save/load a game while running!",

    UI_COULD_NOT_ADJUST_FOR_TARGET_CASH: "The simulation for this scenario had an average of {CURRENCY}{NEWLINE}at the end of every month,{CURRENCY} lower than was{NEWLINE}requested. It will be tighter on cash than was asked for.",

    UI_OBJECTIVE_HEADING: "{PALEGOLD}Objective Info",
    UI_OBJECTIVE: "Objective: ",
    UI_OBJECTIVE_GUESTS_IN_PARK: "{0} guests at the end of {MONTHYEAR}.",
    UI_OBJECTIVE_REPAY_LOAN: "Repay loan and {CURRENCY} park value by the end of{NEWLINE}{MONTHYEAR}.",

    UI_OBJECTIVE_CONDITION_PAY_PER_RIDE: "Guests pay per ride.",
    UI_OBJECTIVE_CONDITION_PAY_FOR_ENTRY: "Guests pay for park entry.",
    UI_OBJECTIVE_CONDITION_LOAN_MODIFICATION: "Loan interest has been modified by {0}%.",
    UI_OBJECTIVE_CONDITION_GUEST_CASH_MODIFICATION: "Guest starting cash is now {CURRENCY}-{CURRENCY}.",
    UI_OBJECTIVE_CONDITION_FORBID_MARKETING: "Marketing campaigns are forbidden.",
    UI_OBJECTIVE_CONDITION_HARDER_GUEST_GENERATION: "Harder guest generation is active.",
    UI_OBJECTIVE_CONDITION_HARDER_PARK_RATING: "Harder park rating is active.",
    UI_OBJECTIVE_CONDITION_FORBID_HIGH_CONSTRUCTION: "High construction is forbidden.",
    UI_OBJECTIVE_CONDITION_FORBID_LAND_CHANGES: "Landscape changes are forbidden.",
    UI_OBJECTIVE_CONDITION_FORBID_TREE_REMOVAL: "Tree removal is forbidden.",
    UI_OBJECTIVE_CONDITION_LESS_INTENSE: "Guests prefer less intense rides.",
    UI_OBJECTIVE_CONDITION_MORE_INTENSE: "Guests prefer more intense rides.",
    UI_OBJECTIVE_CONDITION_UMBRELLA_CHANCE: "Guests have a {0}% chance to generate with an umbrella.",
    UI_OBJECTIVE_CONDITION_NARROW_INTENSITY_PREFERENCE: "Guests have very narrow intensity preferences.",
    UI_OBJECTIVE_CONDITION_MAX_LOAN: "Maximum loan is {CURRENCY}.",
    UI_OBJECTIVE_CONDITION_LAND_COST: "Land and construction rights cost {CURRENCY}.",

    UI_SIMULATION_INFO: "{PALEGOLD}Simulation Info",
    UI_SIMULATION_EXAMINE_DESCRIPTION: "This is the output of the difficulty simulation that gave rise to the{NEWLINE}modified settings. It offers a month by month view of what it 'did'.",
    UI_SIMULATION_AVERAGE_CASH: "The simulation had an average of {CURRENCY} at the end of every month,{NEWLINE}{CURRENCY} greater than the target of {CURRENCY}.",
    UI_SIMULATION_ADJUST_MONTH: "Month: ",
    UI_SIMULATION_ADJUST_YEAR: "Year: ",

    UI_DEFAULT: "Default: ",
}
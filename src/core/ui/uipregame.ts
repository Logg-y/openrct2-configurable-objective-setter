import { pluginversion } from "../../util/pluginversion";
import { tab, tabwindow, label, groupbox, horizontal, button } from "openrct2-flexui";
import { storedNumberSpinner, storedCheckbox, storedDropdown, yesNoBox } from "./uiinclude";
import { StringTable } from "../../util/strings";
import { RandomiserState, RandomiserStates, randomiser } from "../randomisermain";
import { saveStoreMap, loadStoreMap } from "../sharedstorage";
import { UIRandomiserInProgress } from "./uirandomiserinprogress";

var haveLoadedProfile = false;

const objectiveRestrictionTabImage: ImageAnimation =
{
	frameBase: 5511,
	frameCount: 16,
	frameDuration: 3,
}

const mainTabImage: ImageAnimation =
{
	frameBase: 5466,
	frameCount: 1,
	frameDuration: 1,
}

const landTabImage: ImageAnimation =
{
	frameBase: 5176,
	frameCount: 1,
	frameDuration: 1,
	offset: { x: 4, y: 2 }
}

const financialTabImage: ImageAnimation =
{
	frameBase: 5261,
	frameCount: 8,
	frameDuration: 3,
}

const guestTabImage: ImageAnimation =
{
	frameBase: 5568,
	frameCount: 8,
	frameDuration: 3,
}

const profileTabImage: ImageAnimation =
{
	frameBase: 5183,
	frameCount: 1,
	frameDuration: 1,
	offset: { x: 3, y: 1 }
}

const simSettingsTabImage: ImageAnimation =
{
	frameBase: 5205,
	frameCount: 16,
	frameDuration: 4,
}


const MainTab = [
	label({
		text: StringTable.UI_MAIN_SETTINGS
	}),
	storedNumberSpinner({
		storekey: "GuestDifficulty",
		prompt: StringTable.UI_GUEST_DIFFICULTY,
		tooltip: StringTable.UI_GUEST_DIFFICULTY_TOOLTIP,
		extendedhelp: StringTable.UI_GUEST_DIFFICULTY_EXTHELP,
		extendedhelp2: StringTable.UI_GUEST_DIFFICULTY_EXTHELP2,
		defaultvalue: 50,
		minimum: 5,
		maximum: 2000,
		step: 5,
	}),
	storedNumberSpinner({
		storekey: "CashTightness",
		prompt: StringTable.UI_CASH_TIGHTNESS,
		tooltip: StringTable.UI_CASH_TIGHTNESS_TOOLTIP,
		defaultvalue: 350000,
		formatCurrency: true,
		minimum: 0,
		step: 5000,
		spinnerWidth: 120,
	}),
	storedNumberSpinner({
		storekey: "ScenarioLength",
		prompt: StringTable.UI_SCENARIO_LENGTH,
		tooltip: StringTable.UI_SCENARIO_LENGTH_TOOLTIP,
		defaultvalue: 3,
		minimum: 1,
		maximum: 999,
		step: 1,
	}),
	storedNumberSpinner({
		storekey: "PayPerRideChance",
		prompt: StringTable.UI_PAY_PER_RIDE_CHANCE,
		tooltip: StringTable.UI_PAY_PER_RIDE_TOOLTIP,
		defaultvalue: 50,
		minimum: 0,
		maximum: 100,
		step: 5,
	}),
	storedNumberSpinner({
		storekey: "ScenarioInterestRate",
		prompt: StringTable.UI_FINANCIAL_SCENARIO_INTEREST,
		tooltip: StringTable.UI_FINANCIAL_SCENARIO_INTEREST_TOOLTIP,
		defaultvalue: 5,
		minimum: 0,
		maximum: 500,
		decimalPlaces: 2,
		step: 0.1,
	}),
	storedNumberSpinner({
		storekey: "StartingCash",
		prompt: StringTable.UI_STARTING_CASH,
		tooltip: StringTable.UI_STARTING_CASH_TOOLTIP,
		defaultvalue: 200000,
		formatCurrency: true,
		minimum: 0,
		step: 5000,
		spinnerWidth: 120,
	}),
	button({
			text: StringTable.RUN,
			height: 20,
			onClick: () => {
				UIPregameTemplate.close();
				if (RandomiserState !== RandomiserStates.NOT_STARTED && RandomiserState !== RandomiserStates.RANDOMISATION_FAILED)
				{
					ui.showError(StringTable.ERROR, StringTable.UI_ERROR_RANDOMISATION_ALREADY_STARTED)
					return;
				}
				randomiser();
				UIRandomiserInProgress();
				//let manager = new DifficultySimManager;
				//manager.run();
			}
	}),

]
const ObjectiveRestrictionTab = [
	label({
		text: StringTable.UI_OBJECTIVE_RESTRICTION_SETTINGS
	}),
	groupbox({
		text: StringTable.UI_OBJECTIVE_WEIGHTS,
		content: [
			storedNumberSpinner({
				storekey: "ObjectiveWeightGuestsByDate",
				prompt: StringTable.UI_OBJECTIVE_WEIGHT_GUESTS,
				tooltip: StringTable.UI_OBJECTIVE_WEIGHT_GUESTS_TOOLTIP,
				defaultvalue: 5,
				minimum: 0,
				maximum: 2000,
			}),
			storedNumberSpinner({
				storekey: "ObjectiveWeightRepayLoan",
				prompt: StringTable.UI_OBJECTIVE_WEIGHT_REPAY_LOAN,
				tooltip: StringTable.UI_OBJECTIVE_WEIGHT_REPAY_LOAN_TOOLTIP,
				defaultvalue: 1,
				minimum: 0,
				maximum: 2000,
			}),
		]
	}),
	storedCheckbox({
		storekey: "RepayLoanForcePayPerRide",
		prompt: StringTable.UI_OBJECTIVE_REPAY_LOAN_FORCE_PAY_PER_RIDE,
		tooltip: StringTable.UI_OBJECTIVE_REPAY_LOAN_FORCE_PAY_PER_RIDE_TOOLTIP,
		defaultvalue: 1,
	}),
	horizontal([
		label({
			text: StringTable.UI_OBJECTIVE_REPAY_LOAN_REQUIREMENTS,
			tooltip: StringTable.UI_OBJECTIVE_REPAY_LOAN_REQUIREMENTS_TOOLTIP,
		}),
		storedDropdown({
			storekey: "RepayLoanCashMachineSetting",
			defaultvalue: 1,
			items: [StringTable.UI_OBJECTIVE_REPAY_LOAN_CASH_MACHINE_DEFAULT, StringTable.UI_OBJECTIVE_REPAY_LOAN_CASH_MACHINE_ALWAYS, StringTable.UI_OBJECTIVE_REPAY_LOAN_CASH_MACHINE_IF_UNRESEARCHABLE],
		})
	]),

	groupbox({
		text: StringTable.UI_RESTRICTIONS,
		content: [
			storedNumberSpinner({
				storekey: "ForbidAdvertisingChance",
				prompt: StringTable.UI_RESTRICTIONS_ADVERTISING,
				tooltip: StringTable.UI_RESTRICTIONS_ADVERTISING_TOOLTIP,
				defaultvalue: 100,
				minimum: 0,
				maximum: 100,
				step: 5,
			}),
			storedNumberSpinner({
				storekey: "HarderGuestGenerationChance",
				prompt: StringTable.UI_RESTRICTIONS_HARDER_GUEST_GENERATION,
				tooltip: StringTable.UI_RESTRICTIONS_HARDER_GUEST_GENERATION_TOOLTIP,
				defaultvalue: 5,
				minimum: 0,
				maximum: 100,
				step: 5,
			}),
			storedNumberSpinner({
				storekey: "HarderParkRatingChance",
				prompt: StringTable.UI_RESTRICTIONS_HARDER_PARK_RATING,
				tooltip: StringTable.UI_RESTRICTIONS_HARDER_PARK_RATING_TOOLTIP,
				defaultvalue: 70,
				minimum: 0,
				maximum: 100,
				step: 5,
			}),
			storedNumberSpinner({
				storekey: "ForbidHighConstructionChance",
				prompt: StringTable.UI_RESTRICTIONS_HIGH_CONSTRUCTION,
				tooltip: StringTable.UI_RESTRICTIONS_HIGH_CONSTRUCTION_TOOLTIP,
				defaultvalue: 0,
				minimum: 0,
				maximum: 100,
				step: 5,
			}),
			storedNumberSpinner({
				storekey: "ForbidTreeRemovalChance",
				prompt: StringTable.UI_RESTRICTIONS_TREE_REMOVAL,
				tooltip: StringTable.UI_RESTRICTIONS_TREE_REMOVAL_TOOLTIP,
				defaultvalue: 0,
				minimum: 0,
				maximum: 100,
				step: 5,
			}),
			storedNumberSpinner({
				storekey: "ForbidLandscapeChangesChance",
				prompt: StringTable.UI_RESTRICTIONS_LANDSCAPE,
				tooltip: StringTable.UI_RESTRICTIONS_LANDSCAPE_TOOLTIP,
				defaultvalue: 0,
				minimum: 0,
				maximum: 100,
				step: 5,
			}),
		]
	}),
]
const LandTab = [
	label({
		text: StringTable.UI_LAND_SETTINGS
	}),
	storedNumberSpinner({
		storekey: "TilesPer100SGC",
		prompt: StringTable.UI_LAND_TILES_PER_100_SGC,
		tooltip: StringTable.UI_LAND_TILES_PER_100_SGC_TOOLTIP,
		extendedhelp: StringTable.UI_LAND_TILES_PER_100_SGC_EXTHELP,
		defaultvalue: 170,
		minimum: 1,
		maximum: 10000,
		step: 1,
		spinnerWidth: 70,
	}),
	storedNumberSpinner({
		storekey: "TilesPer100SGCHardGuestGen",
		prompt: StringTable.UI_LAND_TILES_PER_100_SGC_HARD_GUEST_GEN,
		tooltip: StringTable.UI_LAND_TILES_PER_100_SGC_HARD_GUEST_GEN_TOOLTIP,
		extendedhelp: StringTable.UI_LAND_TILES_PER_100_SGC_HARD_GUEST_GEN_EXTHELP,
		defaultvalue: 400,
		minimum: 1,
		maximum: 10000,
		step: 1,
		spinnerWidth: 70,
	}),
	storedNumberSpinner({
		storekey: "ParkEntranceProtectionRadius",
		prompt: StringTable.UI_LAND_PARK_ENTRANCE_PROTECTION_RADIUS,
		tooltip: StringTable.UI_LAND_PARK_ENTRANCE_PROTECTION_RADIUS_TOOLTIP,
		defaultvalue: 15,
		minimum: 1,
		maximum: 1000,
		step: 1,
		spinnerWidth: 70,
	}),
	storedNumberSpinner({
		storekey: "ParkFeatureProtectionRadius",
		prompt: StringTable.UI_LAND_PARK_FEATURE_PROTECTION_RADIUS,
		tooltip: StringTable.UI_LAND_PARK_FEATURE_PROTECTION_RADIUS,
		defaultvalue: 3,
		minimum: 1,
		maximum: 1000,
		step: 1,
		spinnerWidth: 70,
	}),
	storedCheckbox({
		storekey: "AllowNewLandBuying",
		prompt: StringTable.UI_LAND_MAKE_BUYABLE,
		tooltip: StringTable.UI_LAND_MAKE_BUYABLE_TOOLTIP,
		defaultvalue: 1,
	}),
	storedCheckbox({
		storekey: "ShrinkSpace",
		prompt: StringTable.UI_LAND_SHRINK_SPACE,
		tooltip: StringTable.UI_LAND_SHRINK_SPACE_TOOLTIP,
		defaultvalue: 0,
	}),
	
]
const FinancialTab = [
	label({
		text: StringTable.UI_FINANCIAL_SETTINGS
	}),
	storedNumberSpinner({
		storekey: "FinancialDifficultyMethodsMin",
		prompt: StringTable.UI_FINANCIAL_DIFFICULTY_METHODS_MIN,
		tooltip: StringTable.UI_FINANCIAL_DIFFICULTY_METHODS_MIN_TOOLTIP,
		defaultvalue: 1,
		minimum: 0,
		maximum: 5,
		step: 1,
	}),
	storedNumberSpinner({
		storekey: "FinancialDifficultyMethodsMax",
		prompt: StringTable.UI_FINANCIAL_DIFFICULTY_METHODS_MAX,
		tooltip: StringTable.UI_FINANCIAL_DIFFICULTY_METHODS_MAX_TOOLTIP,
		defaultvalue: 4,
		minimum: 0,
		maximum: 4,
		step: 1,
	}),
	storedNumberSpinner({
		storekey: "FinancialDifficultyMinInterestRate",
		prompt: StringTable.UI_FINANCIAL_MINIMUM_LOAN_INTEREST,
		tooltip: StringTable.UI_FINANCIAL_MINIMUM_LOAN_INTEREST_TOOLTIP,
		defaultvalue: 15,
		minimum: 0,
		maximum: 200,
		step: 1,
	}),
	groupbox({
		text: StringTable.UI_FINANCIAL_DIFFICULTIES,
		content: [
			storedCheckbox({
				storekey: "FinancialDifficultyGuestCash",
				prompt: StringTable.UI_FINANCIAL_DIFFICULTY_GUEST_STARTING_CASH,
				tooltip: StringTable.UI_FINANCIAL_DIFFICULTY_GUEST_STARTING_CASH_TOOLTIP,
				defaultvalue: 0,
			}),
			storedCheckbox({
				storekey: "FinancialDifficultyLoanInterest",
				prompt: StringTable.UI_FINANCIAL_DIFFICULTY_LOAN_INTEREST,
				tooltip: StringTable.UI_FINANCIAL_DIFFICULTY_LOAN_INTEREST_TOOLTIP,
				defaultvalue: 1,
			}),
			storedCheckbox({
				storekey: "FinancialDifficultyStartDebt",
				prompt: StringTable.UI_FINANCIAL_DIFFICULTY_START_DEBT,
				tooltip: StringTable.UI_FINANCIAL_DIFFICULTY_START_DEBT_TOOLTIP,
				defaultvalue: 1,
			}),
			storedCheckbox({
				storekey: "FinancialDifficultyForceBuyLand",
				prompt: StringTable.UI_FINANCIAL_DIFFICULTY_FORCE_BUY_LAND,
				tooltip: StringTable.UI_FINANCIAL_DIFFICULTY_FORCE_BUY_LAND_TOOLTIP,
				defaultvalue: 0,
			}),
		]
	}),
]
const GuestTab = [
	label({
		text: StringTable.UI_GUEST_SETTINGS
	}),
	groupbox({
		text: StringTable.UI_GUEST_INTENSITY_PREFERENCES,
		content: [
			storedNumberSpinner({
				storekey: "IntensityPreferenceWeightNone",
				prompt: StringTable.UI_GUEST_INTENSITY_NO_PREFERENCE,
				tooltip: StringTable.UI_GUEST_INTENSITY_NO_PREFERENCE_TOOLTIP,
				defaultvalue: 5,
				minimum: 0,
				maximum: 100,
				step: 1,
			}),
			storedNumberSpinner({
				storekey: "IntensityPreferenceWeightHigh",
				prompt: StringTable.UI_GUEST_INTENSITY_HIGH,
				tooltip: StringTable.UI_GUEST_INTENSITY_HIGH_TOOLTIP,
				defaultvalue: 2,
				minimum: 0,
				maximum: 100,
				step: 1,
			}),
			storedNumberSpinner({
				storekey: "IntensityPreferenceWeightLow",
				prompt: StringTable.UI_GUEST_INTENSITY_LOW,
				tooltip: StringTable.UI_GUEST_INTENSITY_LOW_TOOLTIP,
				defaultvalue: 1,
				minimum: 0,
				maximum: 100,
				step: 1,
			}),
		]
	}),
	storedNumberSpinner({
		storekey: "GuestUmbrellaChance",
		prompt: StringTable.UI_GUEST_STARTING_UMBRELLA,
		tooltip: StringTable.UI_GUEST_STARTING_UMBRELLA_TOOLTIP,
		defaultvalue: 5,
		minimum: 0,
		maximum: 100,
		step: 1,
	}),
	storedNumberSpinner({
		storekey: "GuestNarrowIntensity",
		prompt: StringTable.UI_GUEST_NARROW_INTENSITY,
		tooltip: StringTable.UI_GUEST_NARROW_INTENSITY_TOOLTIP,
		extendedhelp: StringTable.UI_GUEST_NARROW_INTENSITY_EXTHELP,
		defaultvalue: 0,
		minimum: 0,
		maximum: 100,
		step: 5,
	}),
]

const ProfileTab = [
	label({
		text: StringTable.UI_PROFILES,
	}),
	storedDropdown({
		storekey: "ActiveProfile",
		defaultvalue: 0,
		items: [StringTable.UI_PROFILE_1, StringTable.UI_PROFILE_2, StringTable.UI_PROFILE_3],
		onChange: val => {
			context.sharedStorage.set<number>("Loggy.ConfigurableObjectiveSetter.ActiveProfileIndex", val);
		}
	}),
	horizontal([
		button({
			text: StringTable.SAVE,
			height: 20,
			onClick: () => {
				yesNoBox(
					{
						text: StringTable.UI_ARE_YOU_SURE_SAVE,
						yesbuttontext: StringTable.OK,
						nobuttontext: StringTable.CANCEL,
						title: StringTable.SAVE,
						yesCallback: saveStoreMap,
					}
				)
			}
		}),	
		button({
			text: StringTable.LOAD,
			height: 20,
			onClick: () => {
				yesNoBox(
					{
						text: StringTable.UI_ARE_YOU_SURE_LOAD,
						yesbuttontext: StringTable.OK,
						nobuttontext: StringTable.CANCEL,
						title: StringTable.LOAD,
						yesCallback: loadStoreMap,
					}
				)
			}
		}),	
	])
]

const SimulationSettingsTab = [
	label({
		text: StringTable.UI_SIMSETTINGS,
	}),
	label({
		text: StringTable.UI_SIMSETTINGS_TOOLTIP,
	}),
	storedNumberSpinner({
		storekey: "SimMonthsPerTick",
		prompt: StringTable.UI_SIMSETTINGS_MONTHS_PER_TICK,
		tooltip: StringTable.UI_SIMSETTINGS_MONTHS_PER_TICK_TOOLTIP,
		defaultvalue: 32,
		minimum: 1,
		step: 1,
		spinnerWidth: 90,
	}),
	storedNumberSpinner({
		storekey: "SimGuestRideIncome",
		prompt: StringTable.UI_SIMSETTINGS_RIDE_INCOME_PER_GUEST,
		tooltip: StringTable.UI_SIMSETTINGS_RIDE_INCOME_PER_GUEST_TOOLTIP,
		defaultvalue: 300,
		minimum: 1,
		step: 10,
		spinnerWidth: 90,
		formatCurrency: true,
	}),
	storedNumberSpinner({
		storekey: "SimGuestStallIncome",
		prompt: StringTable.UI_SIMSETTINGS_STALL_INCOME_PER_GUEST,
		tooltip: StringTable.UI_SIMSETTINGS_STALL_INCOME_PER_GUEST_TOOLTIP,
		defaultvalue: 12,
		minimum: 1,
		step: 2,
		spinnerWidth: 90,
		formatCurrency2dp: true,
	}),
	storedNumberSpinner({
		storekey: "SimCostPer100SGC",
		prompt: StringTable.UI_SIMSETTINGS_COST_PER_100_SGC,
		tooltip: StringTable.UI_SIMSETTINGS_COST_PER_100_SGC_TOOLTIP,
		extendedhelp: StringTable.UI_SIMSETTINGS_COST_PER_100_SGC_EXTHELP,
		defaultvalue: 25000,
		minimum: 1,
		step: 200,
		spinnerWidth: 90,
		formatCurrency: true,
	}),
	storedNumberSpinner({
		storekey: "SimCostPer100SGCHardGuestGen",
		prompt: StringTable.UI_SIMSETTINGS_COST_PER_100_SGC_HARD,
		tooltip: StringTable.UI_SIMSETTINGS_COST_PER_100_SGC_HARD_TOOLTIP,
		defaultvalue: 140000,
		minimum: 1,
		step: 1000,
		spinnerWidth: 90,
		formatCurrency: true,
	}),
	storedNumberSpinner({
		storekey: "SimParkEntryPer100SGC",
		prompt: StringTable.UI_SIMSETTINGS_PARK_ENTRY_FEE_PER_100_SGC,
		tooltip: StringTable.UI_SIMSETTINGS_PARK_ENTRY_FEE_PER_100_SGC_TOOLTIP,
		defaultvalue: 100,
		minimum: 1,
		step: 200,
		spinnerWidth: 90,
		formatCurrency: true,
	}),
	storedNumberSpinner({
		storekey: "SimRideUpkeepPer100SGC",
		prompt: StringTable.UI_SIMSETTINGS_RIDE_UPKEEP_PER_100_SGC,
		tooltip: StringTable.UI_SIMSETTINGS_RIDE_UPKEEP_PER_100_SGC_TOOLTIP,
		defaultvalue: 300,
		minimum: 1,
		step: 10,
		spinnerWidth: 90,
		formatCurrency: true,
	}),
	storedNumberSpinner({
		storekey: "SimStaffWagesPer100SGC",
		prompt: StringTable.UI_SIMSETTINGS_STAFF_WAGES_PER_100_SGC,
		tooltip: StringTable.UI_SIMSETTINGS_STAFF_WAGES_PER_100_SGC_TOOLTIP,
		defaultvalue: 1200,
		minimum: 1,
		step: 50,
		spinnerWidth: 90,
		formatCurrency: true,
	}),
	storedNumberSpinner({
		storekey: "SimForbidTreeRemovalSquareCost",
		prompt: StringTable.UI_SIMSETTINGS_FORBID_TREE_REMOVAL_LOSS,
		tooltip: StringTable.UI_SIMSETTINGS_FORBID_TREE_REMOVAL_LOSS_TOOLTIP,
		defaultvalue: 4,
		minimum: 0,
		step: 0.1,
		spinnerWidth: 90,
		decimalPlaces: 2,
	}),
	storedNumberSpinner({
		storekey: "SimForbidHighConstructionLandUsage",
		prompt: StringTable.UI_SIMSETTINGS_FORBID_HIGH_CONSTRUCTION_SGC_MULTIPLIER,
		tooltip: StringTable.UI_SIMSETTINGS_FORBID_HIGH_CONSTRUCTION_SGC_MULTIPLIER_TOOLTIP,
		defaultvalue: 1.5,
		minimum: 0,
		step: 0.05,
		spinnerWidth: 90,
		decimalPlaces: 2,
	}),
	storedNumberSpinner({
		storekey: "SimGuestTurnoverMinimum",
		prompt: StringTable.UI_SIMSETTINGS_GUEST_TURNOVER_MINIMUM,
		tooltip: StringTable.UI_SIMSETTINGS_GUEST_TURNOVER_MINIMUM_TOOLTIP,
		defaultvalue: 1.0,
		minimum: 0,
		maximum: 100,
		step: 0.1,
		spinnerWidth: 90,
		decimalPlaces: 2,
	}),
	storedNumberSpinner({
		storekey: "SimGuestTurnoverMaximum",
		prompt: StringTable.UI_SIMSETTINGS_GUEST_TURNOVER_MAXIMUM,
		tooltip: StringTable.UI_SIMSETTINGS_GUEST_TURNOVER_MAXIMUM_TOOLTIP,
		extendedhelp: StringTable.UI_SIMSETTINGS_GUEST_TURNOVER_MAXIMUM_EXTHELP,
		defaultvalue: 7,
		minimum: 0,
		maximum: 100,
		step: 0.1,
		spinnerWidth: 90,
		decimalPlaces: 2,
	}),
	storedNumberSpinner({
		storekey: "SimGuestBrokeLeaveProbability",
		prompt: StringTable.UI_SIMSETTINGS_GUEST_TURNOVER_BROKE_GUEST_LEAVE_PROBABILIY,
		tooltip: StringTable.UI_SIMSETTINGS_GUEST_TURNOVER_BROKE_GUEST_LEAVE_DELAY_TOOLTIP,
		defaultvalue: 30,
		minimum: 0,
		maximum: 100,
		step: 1,
		spinnerWidth: 90,
		decimalPlaces: 1,
	}),
]

const UIPregameTemplate = tabwindow(
{
	title: `${StringTable.PLUGIN_MENU_ITEM} v${pluginversion}`,
    width: {value: 400, max: 10000},
    height: {value: 550, max: 10000},
	padding: 5,
	tabs: [
		tab({
			image: mainTabImage,
			height: "auto",
			content: MainTab,
		}),
		tab({
			image: objectiveRestrictionTabImage,
			height: "auto",
			content: ObjectiveRestrictionTab,
		}),
		tab({
			image: landTabImage,
			height: "auto",
			content: LandTab,
		}),
		tab({
			image: financialTabImage,
			height: "auto",
			content: FinancialTab,
		}),
		tab({
			image: guestTabImage,
			height: "auto",
			content: GuestTab,
		}),
		tab({
			image: profileTabImage,
			height: "auto",
			content: ProfileTab,
		}),
		tab({
			image: simSettingsTabImage,
			height: "auto",
			content: SimulationSettingsTab,
		})
	],
});

export function UIPregame(): void
{
    if (typeof ui !== "undefined")
    {
		// Only load saved profile data if this is the first time opening the UI and there was no data already there to overwrite
        UIPregameTemplate.open()
		
		if (haveLoadedProfile == false)
		{
			console.log("Objective Configurer: First load, fetching saved profile data")
			loadStoreMap();
			haveLoadedProfile = true;
		}
    }
}


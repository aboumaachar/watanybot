import { armyDeceasedSource } from "./adapters/armyDeceased.adapter";
import { isfDeathsSource } from "./adapters/isfDeaths.adapter";

export const AL_WAFIYAT_SOURCES = [armyDeceasedSource, isfDeathsSource] as const;
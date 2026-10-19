/**
 * Types repris du contrat Swagger du serveur Eco ("Eco Game API v1").
 * Source : http://localhost:3001/swagger/v1/swagger.json
 */

export interface ServerInfo {
  External: boolean;
  WebPort: number;
  IsLAN: boolean;
  Description: string;
  DetailedDescription: string;
  Category: string;
  OnlinePlayers: number;
  TotalPlayers: number;
  OnlinePlayersNames: string[];
  AdminOnline: boolean;
  DaysRunning: number;
  DaysUntilMeteor: number;
  Animals: number;
  Plants: number;
  Laws: number;
  WorldSize: string;
  Version: string;
  EconomyDesc: string;
  Language: string;
  HasPassword: boolean;
  HasMeteor: boolean;
  Playtimes: string;
  DiscordAddress: string;
  IsPaused: boolean;
  ActiveAndOnlinePlayers: number;
  PeakActivePlayers: number;
  TotalCulture: number;
  CollaborationLevel: string;
  GameSpeed: string;
  SimulationLevel: string;
  Access: string;
  JoinUrl?: string;
  ExhaustionActive: boolean;
  ExhaustionAfterHours: number;
  ShelfLifeMultiplier: number;
}

/** Une serie temporelle renvoyee par /datasets/get. */
export interface DataSet {
  Times: number[];
  Values: number[];
  Interval: number;
  Unit: string;
}

/** Metadonnee d’une statistique (/datasets/flatlist). */
export interface StatInfo {
  Name: string;
  DisplayName: string;
  Unit: string;
  UnitDisplayName: string;
  StatType: 'ContinuousValue' | 'EventValue';
  ShortName: string;
  Description: string;
  Tags: string[];
  ValueKey: string;
  HasValueKey: boolean;
  IsCustom: boolean;
  IsAction: boolean;
  IsCountable: boolean;
  IsAggregatable: boolean;
  TimeKey: string;
}

/** Noeud de l’arbre des statistiques (/datasets/treelist). */
export interface StatTree {
  Name: string | null;
  DisplayName: string | null;
  ChildrenCategories: StatTree[];
  ChildrenStats: StatInfo[];
}

export interface Vector3 { x: number; y: number; z: number; }

export interface MapEntity { Position: Vector3; EntityType: string; }

export interface WorldLayer {
  LayerName: string;
  LayerDisplayName: string;
  Summary: string;
  Tooltip: string;
  Category: string;
  DisplayRow: number;
}

export interface User { Name: string; PlayFabId: string; SteamId: string; }

export interface ChatMessage {
  Timestamp: number;
  Sender: string;
  Receiver: string;
  Text: string;
}

export interface CommandResult {
  CommandMessages: Array<{ Message?: string; Text?: string; Type?: string } | string>;
  OriginalCommand: string;
  Errored: boolean;
}

export interface Law {
  Description: string;
  Id: number;
  Name: string;
  UserDescription: string;
  State: string;
  Creator: string;
}

export interface ElectionChoice {
  Id: number;
  Name: string;
  Speech: string;
}

export interface ElectionComment {
  Username: string;
  Text: string;
  Timestamp: number;
  Graph?: unknown;
  Map?: unknown;
}

export interface ElectedTitle {
  Id: number;
  Name: string;
  UserDescription: string;
  State: string;
  Creator: string;
  OccupantNames: string[];
  Table?: unknown[];
}

export interface ElectionResults {
  ChoiceRanks: unknown[];
  TotalVotesForWinner: number;
  Winners: string[];
  Result: string;
  Finished: boolean;
}

/** Corps attendu par POST /api/v1/elections/vote. */
export interface RunoffVote {
  ElectionID: number;
  Voter: string;
  RankedVotes: number[];
}

export interface Election {
  Id: number;
  Name: string;
  UserDescription: string;
  State: string;
  Creator: string;
  ElectionDescription: string;
  Choices: ElectionChoice[];
  TotalVotes: number;
  TimeStart: number;
  TimeEnd: number;
  TimeStartAgo: number;
  TimeEndAgo: number;
  Finished: boolean;
  Passed: boolean;
  PendingVote: boolean;
  BooleanElection: boolean;
  PollElection: boolean;
  Comments: ElectionComment[];
  Provisions: unknown[];
  Results: ElectionResults | null;
  ElectionProcess: Record<string, unknown> | null;
  PositionForWinner: ElectedTitle | null;
}

export interface WebPluginInfo {
  TypeName: string;
  FontAwesomeIcon: string;
  PluginIndexUrl: string;
  MenuTitle: string;
}

/** Identite du porteur du jeton, telle que renvoyee par /isadmin. */
export interface AdminFlag { isAdmin: boolean; }

export interface ProfilingResult { Name: string; Size: number; CreatedAt: string; }

export interface PluginInfo { TypeName: string; Status?: string; HasConfig: boolean; }

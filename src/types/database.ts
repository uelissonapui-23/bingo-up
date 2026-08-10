export type PlatformRole = 'platform_owner' | 'platform_admin'
export type WorkspaceRole = 'organizer_owner' | 'organizer_admin' | 'event_manager' | 'seller' | 'draw_operator'
export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked'
export type EventStatus = 'draft' | 'sales_open' | 'sales_paused' | 'ready' | 'drawing' | 'paused' | 'finished' | 'canceled' | 'archived'
export type EventSalesMode = 'open_pool' | 'assigned_cards'

export type Profile = {
  id: string
  display_name: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export type Workspace = {
  id: string
  name: string
  slug: string
  owner_user_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type WorkspaceMembership = {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  status: MembershipStatus
  created_at: string
  updated_at: string
}

export type WorkspaceWithMembership = Workspace & {
  membership: Pick<WorkspaceMembership, 'id' | 'role' | 'status'>
}

export type BingoEvent = {
  id: string
  workspace_id: string
  name: string
  slug: string
  public_code: string
  description: string | null
  location_name: string | null
  address: string | null
  starts_at: string | null
  ends_at: string | null
  sales_open_at: string | null
  sales_close_at: string | null
  status: EventStatus
  banner_path: string | null
  created_by: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type EventSettings = {
  event_id: string
  workspace_id: string
  timezone: string
  currency: string
  default_card_price: number
  require_buyer_name: boolean
  require_buyer_phone: boolean
  require_buyer_email: boolean
  allow_reservations: boolean
  reservation_minutes: number
  sales_mode: EventSalesMode
  public_panel_show_last_number: boolean
  public_panel_show_called_numbers: boolean
  public_panel_show_progress: boolean
  public_panel_show_near_winners: boolean
  near_winner_thresholds: number[]
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type EventWithSettings = BingoEvent & { settings: EventSettings }

export type BingoDistributionMode = 'any' | 'column_ranges'
export type CardOrientation = 'portrait' | 'landscape'
export type CardPageSize = 'A4' | 'letter'
export type CardBannerPosition = 'top' | 'bottom' | 'none'

export type BingoColumnDefinition = { label: string; min: number; max: number; count: number }
export type BingoWinPattern = { code: string; name: string; kind: string; [key: string]: unknown }

export type BingoRuleSet = {
  id: string
  workspace_id: string
  event_id: string
  name: string
  code: string
  total_balls: number
  grid_rows: number
  grid_columns: number
  numbers_per_game: number
  free_center: boolean
  distribution_mode: BingoDistributionMode
  column_definitions: BingoColumnDefinition[]
  win_patterns: BingoWinPattern[]
  is_default: boolean
  is_active: boolean
  locked_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CardTemplate = {
  id: string
  workspace_id: string
  event_id: string
  name: string
  physical_format: number
  layout_key: string
  orientation: CardOrientation
  page_size: CardPageSize
  banner_position: CardBannerPosition
  banner_height_mm: number
  show_event_name: boolean
  show_event_date: boolean
  show_card_code: boolean
  show_series: boolean
  show_qr_code: boolean
  options: Record<string, unknown>
  is_default: boolean
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CardBatchStatus = 'draft' | 'generating' | 'completed' | 'failed' | 'canceled'
export type GenerationUniquenessMode = 'strict' | 'controlled'
export type PhysicalCardStatus = 'available' | 'reserved' | 'sold' | 'canceled' | 'void'
export type SaleStatus = 'reserved' | 'completed' | 'canceled'
export type SaleItemStatus = 'active' | 'canceled'
export type SaleChannel = 'organizer' | 'seller' | 'online' | 'import'

export type CardBatch = {
  id: string
  workspace_id: string
  event_id: string
  rule_set_id: string
  template_id: string
  series_code: string
  physical_format: number
  requested_cards: number
  requested_games: number
  start_number: number
  code_padding: number
  uniqueness_mode: GenerationUniquenessMode
  status: CardBatchStatus
  generated_cards: number
  generated_games: number
  unique_games_created: number
  reused_games: number
  capacity_snapshot: Record<string, unknown>
  generation_options: Record<string, unknown>
  error_message: string | null
  created_by: string | null
  started_at: string | null
  completed_at: string | null
  canceled_at: string | null
  created_at: string
  updated_at: string
}

export type GameDefinition = {
  id: string
  workspace_id: string
  event_id: string
  rule_set_id: string
  signature: string
  numbers: number[]
  cells: Array<number | null>
  created_at: string
}

export type PhysicalCard = {
  id: string
  workspace_id: string
  event_id: string
  batch_id: string
  rule_set_id: string
  template_id: string
  code: string
  sequence_number: number
  physical_format: number
  composition_signature: string
  public_token: string
  status: PhysicalCardStatus
  assigned_to_user_id: string | null
  version: number
  first_printed_at: string | null
  last_printed_at: string | null
  print_count: number
  sold_at: string | null
  sold_by_user_id: string | null
  current_sale_id: string | null
  reserved_at: string | null
  reserved_by_user_id: string | null
  reservation_expires_at: string | null
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
  created_at: string
  updated_at: string
}

export type CardGame = {
  id: string
  workspace_id: string
  event_id: string
  batch_id: string
  physical_card_id: string
  game_definition_id: string
  position: number
  created_at: string
}


export type Sale = {
  id: string
  workspace_id: string
  event_id: string
  status: SaleStatus
  channel: SaleChannel
  seller_user_id: string | null
  buyer_name: string | null
  buyer_phone: string | null
  buyer_email: string | null
  buyer_notes: string | null
  currency: string
  total_amount: number
  reservation_expires_at: string | null
  completed_at: string | null
  canceled_at: string | null
  canceled_by: string | null
  cancel_reason: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SaleItem = {
  id: string
  workspace_id: string
  event_id: string
  sale_id: string
  physical_card_id: string
  unit_price: number
  status: SaleItemStatus
  canceled_at: string | null
  created_at: string
}

export type DrawSessionStatus = 'active' | 'paused' | 'finished' | 'canceled'
export type DrawNumberStatus = 'called' | 'voided'

export type DrawSession = {
  id: string
  workspace_id: string
  event_id: string
  rule_set_id: string
  session_number: number
  name: string
  status: DrawSessionStatus
  total_balls: number
  win_pattern_code: string
  win_pattern_snapshot: Record<string, unknown>
  rule_snapshot: Record<string, unknown>
  participant_cards: number
  participant_games: number
  called_count: number
  last_called_number: number | null
  draw_method?: 'automatic' | 'manual'
  continues_previous?: boolean
  continuation_source_session_id?: string | null
  exclude_previously_awarded_games?: boolean
  public_token: string
  created_by: string | null
  started_at: string
  paused_at: string | null
  finished_at: string | null
  canceled_at: string | null
  created_at: string
  updated_at: string
}

export type DrawNumber = {
  id: string
  workspace_id: string
  event_id: string
  session_id: string
  number: number
  sequence_number: number
  status: DrawNumberStatus
  called_by: string | null
  called_at: string
  voided_by: string | null
  voided_at: string | null
  void_reason: string | null
  created_at: string
}

export type DrawSessionGame = {
  session_id: string
  workspace_id: string
  event_id: string
  physical_card_id: string
  card_game_id: string
  game_definition_id: string
  position: number
  created_at: string
}

export type GameProgress = {
  session_id: string
  workspace_id: string
  event_id: string
  physical_card_id: string
  card_game_id: string
  game_definition_id: string
  position: number
  matched_count: number
  missing_count: number
  is_winner: boolean
  completed_at: string | null
  last_evaluated_at: string
}

export type WinnerCandidateStatus = 'detected' | 'confirmed' | 'dismissed' | 'invalidated'
export type WinnerCandidate = {
  id: string
  workspace_id: string
  event_id: string
  session_id: string
  physical_card_id: string
  card_game_id: string
  game_definition_id: string
  trigger_draw_number_id: string | null
  status: WinnerCandidateStatus
  detected_at: string
  resolved_at: string | null
  resolved_by: string | null
  resolution_note: string | null
  created_at: string
}

export type Winner = {
  id: string
  workspace_id: string
  event_id: string
  session_id: string
  candidate_id: string
  physical_card_id: string
  card_game_id: string
  game_definition_id: string
  confirmed_by: string | null
  confirmed_at: string
  confirmation_note: string | null
  created_at: string
}

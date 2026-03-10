# ITP Room Booking Implementation Plan

## Approach: Option A (実用的な現行路線の延長)

MCとITPのワークフローの差は大きいので、無理に統合せず明示的に分けて共通部分だけ共有する。
ただしif/elseの散在は整理して、3つ目のテナント追加に備える。

---

## Phase 0: Firestore ITPスキーマデータ確認・整備

### 現状 (development環境)
- `tenantSchema/itp` ドキュメントは存在する
- 9部屋登録済み: Doc Lab(402), Huddle Room×5(421,422,446,447,448), Phone Booth×3(467,469,477)
- Google CalendarID: dev/prod両方設定済み（448のprodのみ空）
- `supportVIP: false`, `supportWalkIn: false`
- `autoApproval`: 全部屋 minHour/maxHour = -1（自動承認なし）
- `services`: 空文字列配列 `[""]`（ゴミデータ、空配列にすべき）
- `emailMessages`: ほぼ空文字列（`approvalNotice`のみテスト文）
- `roleMapping`, `programMapping`, `schoolMapping`: 空オブジェクト（sync時に削除された旧データあり）
- `agreements`: 1件のみ（bookingPolicy）

### 要対応
- [x] `services: [""]` → `services: []` に修正（全部屋） ✅ done via updateItpHuddleRooms script
- [ ] `emailMessages` の各テンプレートを作成（ITP用の文面） — PM確認待ち
- [ ] `roleMapping` / `programMapping` / `schoolMapping` を設定するか、使わない場合の動作確認 — PM確認待ち
- [ ] `autoApproval` ルールを設定（どの部屋をどのロールで自動承認するか決める） — 一旦無効で進める
- [x] `calendarIdProd` 未設定の部屋(448)を確認 ✅ done via updateItpHuddleRooms script
- [ ] 必要に応じて `supportWalkIn: true` に — PM確認待ち
- [x] Huddle Room 5部屋のみに絞り込み ✅ done via updateItpHuddleRooms script
- [x] 24時間対応 (startHour "00:00:00") ✅ done via updateItpHuddleRooms script

---

## Phase 1: 基盤整備 — テナントポリシーとメール配信 ✅ DONE

| # | タスク | 対象ファイル |
|---|--------|-------------|
| 1.1 | ✅ `itpPolicy.ts` 新規作成（ITP運用メール等の定数） | `components/src/itpPolicy.ts` |
| 1.2 | ✅ テナントポリシーレジストリ作成（`getTenantPolicy(tenant)`） | `components/src/tenantPolicy.ts` |
| 1.3 | ✅ `getApprovalCcEmail` / `getCancelCcEmail` をテナント対応に | `components/src/policy.ts` |
| 1.4 | ✅ 呼び出し元を更新 | `xstateUtilsV5.ts`, `server/admin.ts`, `server/db.ts`, `bookingsDirect/route.ts` |

---

## Phase 2: 管理画面のITP対応（コア機能） ✅ DONE

| # | タスク | 詳細 |
|---|--------|------|
| 2.1 | ✅ 承認アクションのラベル修正 | `Actions.APPROVE` 追加、`getTenantPolicy().approvalLevels` で分岐 |
| 2.2 | ✅ Checked Out → Closed の自動遷移 | ITP machine: `always` transition で即close |
| 2.3 | ✅ `useBookingActions` のITP対応確認 | サービス系は `isMediaCommons` ガードで非表示確認済み |

---

## Phase 3: ハードコードされた部屋IDをスキーマ駆動に

| # | タスク | 詳細 |
|---|--------|------|
| 3.1 | スキーマの`resources`属性で既にカバーされている範囲を確認 | `needsSafetyTraining`, `isWalkIn`, `autoApproval`等は済み |
| 3.2 | 不足している属性を追加（`roomCategory`等） | `MOCAP_ROOMS`, `EVENT_ONLY_ROOMS`等の置き換え |
| 3.3 | スキーマベースの部屋クエリユーティリティ作成 | `roomPolicyUtils.ts` |
| 3.4 | `mediaCommonsPolicy.ts` の定数配列を非推奨化 | メール定数はレジストリに移行済み |

---

## Phase 4: if/else散在の整理（レジストリパターン）

| # | タスク | 詳細 |
|---|--------|------|
| 4.1 | `TenantCapabilities` interface定義 | `approvalLevels`, `hasServiceRequests`, `autoCloseOnCheckout`等 |
| 4.2 | 16ファイルの `isMediaCommons()` / `isITP()` をcapabilitiesベースに置換 | 正当にMC固有のものは残す |

---

## Phase 5: Walk-in / VIP対応

| # | タスク |
|---|--------|
| 5.1 | ITPのwalk-in予約フロー検証・修正 |
| 5.2 | ITPスキーマの`supportWalkIn`フラグ確認 |
| 5.3 | VIP対応（必要なら） |

---

## Phase 6: Cronジョブ・自動処理

| # | タスク |
|---|--------|
| 6.1 | auto-checkoutがITPコレクションも処理するか検証 |
| 6.2 | auto-cancel-declinedのITP対応確認 |
| 6.3 | checkout時の自動close実装（Phase 2.2と連動） |

---

## 依存関係

```
Phase 0 (データ整備) ← 先にやる
  |
Phase 1 (基盤)
  ├→ Phase 2 (管理画面) → Phase 5 (Walk-in/VIP)
  ├→ Phase 3 (スキーマ駆動) → Phase 6 (Cron)
  └→ Phase 4 (レジストリ) ← Phase 2完了後いつでも
```

---

## リスク

- ITPの`tenantSchema`データが不完全（emailMessages空、mapping空）
- legacy `xstateUtils.ts` との共存 — ITPは必ずv5パスを使うこと
- ITP machineの`always`遷移で自動承認が即発火する設計の検証

---

## Key Files

| ファイル | 役割 |
|---------|------|
| `components/src/policy.ts` | テナント対応メールCC |
| `components/src/mediaCommonsPolicy.ts` | ハードコードMC部屋ID |
| `components/src/client/routes/admin/hooks/useBookingActions.tsx` | 管理画面アクション |
| `lib/stateMachines/itpBookingMachine.ts` | ITP状態遷移（9KB） |
| `lib/stateMachines/mcBookingMachine.ts` | MC状態遷移（67KB、参照用） |
| `lib/stateMachines/xstateEffects.ts` | 状態遷移の副作用 |
| `lib/stateMachines/xstateTransitions.ts` | XState遷移実行 |
| `app/api/bookings/route.ts` | 予約作成パス |
| `scripts/syncTenantSchemas.ts` | スキーマ同期スクリプト |
| `components/src/client/routes/components/SchemaProvider.tsx` | デフォルトスキーマ定義 |

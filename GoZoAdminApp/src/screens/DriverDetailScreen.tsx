import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  SafeAreaView,
  StatusBar,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../theme';
import {
  fetchDriverEarnings,
  recordDriverPayment,
  updateDriverProfile,
  Driver,
  DriverEarningTrip,
  DriverPayment,
  DriverEarningsSummary,
} from '../api';

type Tab = 'profile' | 'earnings';

const EMPTY_SUMMARY: DriverEarningsSummary = {
  totalDriverEarning: 0,
  totalAccepted: 0,
  totalGozoCut: 0,
  totalPaid: 0,
  outstandingDebt: 0,
};

export default function DriverDetailScreen({ route, navigation }: any) {
  const { driver: initialDriver }: { driver: Driver } = route.params;

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [driver, setDriver] = useState<Driver>(initialDriver);

  // Earnings state
  const [trips, setTrips] = useState<DriverEarningTrip[]>([]);
  const [payments, setPayments] = useState<DriverPayment[]>([]);
  const [summary, setSummary] = useState<DriverEarningsSummary>(EMPTY_SUMMARY);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsError, setEarningsError] = useState<string | null>(null);

  // Edit profile state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFields, setEditFields] = useState<Partial<Driver>>({});

  // Payment modal state
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  const loadEarnings = async () => {
    setEarningsLoading(true);
    setEarningsError(null);
    try {
      const res = await fetchDriverEarnings(driver.id);
      if (res.success) {
        setTrips(res.trips);
        setPayments(res.payments);
        setSummary(res.summary);
      } else {
        setEarningsError(res.error || 'Failed to load earnings');
      }
    } catch (e: any) {
      setEarningsError(e.message);
    } finally {
      setEarningsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'earnings') loadEarnings();
  }, [activeTab]);

  const startEdit = () => {
    setEditFields({
      name: driver.name,
      phone: driver.phone,
      vehicle_number: driver.vehicle_number,
      vehicle_type: driver.vehicle_type,
      gozo_phone: driver.gozo_phone ?? '',
      permanent_address: driver.permanent_address ?? '',
      aadhaar_number: driver.aadhaar_number ?? '',
      pan_number: driver.pan_number ?? '',
      dl_number: driver.dl_number ?? '',
      dl_expiry: driver.dl_expiry ?? '',
      bank_account_number: driver.bank_account_number ?? '',
      bank_ifsc: driver.bank_ifsc ?? '',
      bank_account_name: driver.bank_account_name ?? '',
    });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await updateDriverProfile(driver.id, editFields);
      if (res.success) {
        setDriver({ ...driver, ...editFields } as Driver);
        setEditing(false);
        Alert.alert('Saved', 'Driver profile updated successfully.');
      } else {
        Alert.alert('Error', res.error || 'Failed to save profile');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid', 'Enter a valid payment amount.');
      return;
    }
    setRecordingPayment(true);
    try {
      const res = await recordDriverPayment(driver.id, amount, paymentNotes.trim() || undefined);
      if (res.success) {
        setPaymentModal(false);
        setPaymentAmount('');
        setPaymentNotes('');
        await loadEarnings();
        Alert.alert('Recorded', `₹${amount} payment recorded successfully.`);
      } else {
        Alert.alert('Error', res.error || 'Failed to record payment');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setRecordingPayment(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const fmtCurrency = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  // ─── Render Profile Tab ───
  const renderProfileTab = () => {
    const f = editing ? editFields : driver;
    const Field = ({ label, value, field }: { label: string; value?: string; field?: keyof typeof editFields }) => (
      <View style={s.fieldRow}>
        <Text style={s.fieldLabel}>{label}</Text>
        {editing && field ? (
          <TextInput
            style={s.fieldInput}
            value={(editFields as any)[field] ?? ''}
            onChangeText={(v) => setEditFields({ ...editFields, [field]: v })}
            placeholderTextColor={COLORS.textSecondary}
            placeholder={`Enter ${label.toLowerCase()}`}
          />
        ) : (
          <Text style={[s.fieldValue, !value && s.fieldEmpty]}>{value || '—'}</Text>
        )}
      </View>
    );

    return (
      <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
        {/* Actions */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.callBtn} onPress={() => driver.phone && Linking.openURL(`tel:${driver.phone}`)}>
            <Text style={s.callBtnText}>📞  Call Driver</Text>
          </TouchableOpacity>
          {editing ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={cancelEdit}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, saving && s.disabledBtn]} onPress={saveEdit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.editBtn} onPress={startEdit}>
              <Text style={s.editBtnText}>✏️  Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Basic Info */}
        <View style={s.card}>
          <Text style={s.cardTitle}>BASIC INFO</Text>
          <Field label="Full Name" value={driver.name} field="name" />
          <View style={s.divider} />
          <Field label="Phone" value={driver.phone} field="phone" />
          <View style={s.divider} />
          <Field label="GoZo Phone" value={driver.gozo_phone} field="gozo_phone" />
          <View style={s.divider} />
          <Field label="Status" value={driver.status} />
        </View>

        {/* KYC */}
        <View style={s.card}>
          <Text style={s.cardTitle}>KYC DOCUMENTS</Text>
          <Field label="Aadhaar Number" value={driver.aadhaar_number} field="aadhaar_number" />
          <View style={s.divider} />
          <Field label="PAN Number" value={driver.pan_number} field="pan_number" />
          <View style={s.divider} />
          <Field label="DL Number" value={driver.dl_number} field="dl_number" />
          <View style={s.divider} />
          <Field label="DL Expiry" value={driver.dl_expiry} field="dl_expiry" />
          <View style={s.divider} />
          <Field label="Permanent Address" value={driver.permanent_address} field="permanent_address" />
        </View>

        {/* Vehicle */}
        <View style={s.card}>
          <Text style={s.cardTitle}>VEHICLE DETAILS</Text>
          <Field label="Vehicle Number" value={driver.vehicle_number} field="vehicle_number" />
          <View style={s.divider} />
          <Field label="Vehicle Type" value={driver.vehicle_type} field="vehicle_type" />
        </View>

        {/* Bank */}
        <View style={s.card}>
          <Text style={s.cardTitle}>BANK DETAILS</Text>
          <Field label="Account Number" value={driver.bank_account_number} field="bank_account_number" />
          <View style={s.divider} />
          <Field label="IFSC Code" value={driver.bank_ifsc} field="bank_ifsc" />
          <View style={s.divider} />
          <Field label="Account Name" value={driver.bank_account_name} field="bank_account_name" />
        </View>
      </ScrollView>
    );
  };

  // ─── Render Earnings Tab ───
  const renderEarningsTab = () => {
    if (earningsLoading) {
      return (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }
    if (earningsError) {
      return (
        <View style={s.centered}>
          <Text style={s.errorText}>{earningsError}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadEarnings}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    const debtColor = summary.outstandingDebt > 0 ? COLORS.cancelled : '#059669';

    return (
      <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
        {/* Debt Summary Card */}
        <View style={[s.card, s.debtCard]}>
          <Text style={s.cardTitle}>FINANCIAL SUMMARY</Text>
          <View style={s.summaryGrid}>
            <View style={s.summaryCell}>
              <Text style={s.summaryCellLabel}>Driver Earned</Text>
              <Text style={[s.summaryCellValue, { color: COLORS.primary }]}>{fmtCurrency(summary.totalDriverEarning)}</Text>
            </View>
            <View style={s.summaryCell}>
              <Text style={s.summaryCellLabel}>GoZo Commission</Text>
              <Text style={[s.summaryCellValue, { color: '#F59E0B' }]}>{fmtCurrency(summary.totalGozoCut)}</Text>
            </View>
            <View style={s.summaryCell}>
              <Text style={s.summaryCellLabel}>Total Paid</Text>
              <Text style={[s.summaryCellValue, { color: '#059669' }]}>{fmtCurrency(summary.totalPaid)}</Text>
            </View>
            <View style={s.summaryCell}>
              <Text style={s.summaryCellLabel}>Outstanding Debt</Text>
              <Text style={[s.summaryCellValue, { color: debtColor, fontSize: 20 }]}>{fmtCurrency(summary.outstandingDebt)}</Text>
            </View>
          </View>

          <TouchableOpacity style={s.recordPaymentBtn} onPress={() => setPaymentModal(true)}>
            <Text style={s.recordPaymentBtnText}>+ Record Payment</Text>
          </TouchableOpacity>
        </View>

        {/* Payment History */}
        {payments.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>PAYMENT HISTORY</Text>
            {payments.map((p, i) => (
              <View key={p.id}>
                {i > 0 && <View style={s.divider} />}
                <View style={s.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.paymentDate}>{formatDate(p.created_at)}</Text>
                    {p.notes ? <Text style={s.paymentNotes}>{p.notes}</Text> : null}
                  </View>
                  <Text style={s.paymentAmount}>+ {fmtCurrency(p.amount)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Trip History */}
        <Text style={s.sectionHeader}>COMPLETED TRIPS ({trips.length})</Text>
        {trips.length === 0 ? (
          <View style={s.emptyContainer}>
            <Text style={s.emptyText}>No completed trips yet.</Text>
          </View>
        ) : (
          trips.map((t) => {
            const cleanGoods = (t.goods_type || '').split('_dist_')[0];
            return (
              <View key={t.id} style={s.tripCard}>
                <View style={s.tripHeader}>
                  <Text style={s.tripId}>GOZO-{t.id.slice(0, 7).toUpperCase()}</Text>
                  <Text style={s.tripDate}>{formatDate(t.created_at)}</Text>
                </View>
                <Text style={s.tripRoute} numberOfLines={1}>🟢 {t.pickup_address}</Text>
                <Text style={s.tripRoute} numberOfLines={1}>🔴 {t.drop_address}</Text>
                <View style={s.tripFooter}>
                  <Text style={s.tripGoods}>{cleanGoods} • {t.weight_kg}kg</Text>
                  <View style={s.tripPriceBlock}>
                    <Text style={s.tripDriverEarning}>Driver: {fmtCurrency(t.driver_earning)}</Text>
                    {t.gozo_cut > 0 && (
                      <Text style={s.tripGozoCut}>GoZo: {fmtCurrency(t.gozo_cut)}</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerName} numberOfLines={1}>{driver.name}</Text>
          <Text style={s.headerPhone}>{driver.phone}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: driver.status === 'available' ? '#059669' : driver.status === 'in_ride' ? COLORS.primary : '#475569' }]}>
          <Text style={s.statusText}>{driver.status ?? 'offline'}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tab, activeTab === 'profile' && s.activeTab]} onPress={() => setActiveTab('profile')}>
          <Text style={[s.tabLabel, activeTab === 'profile' && s.activeTabLabel]}>👤  Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === 'earnings' && s.activeTab]} onPress={() => setActiveTab('earnings')}>
          <Text style={[s.tabLabel, activeTab === 'earnings' && s.activeTabLabel]}>💰  Earnings & Debt</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'profile' ? renderProfileTab() : renderEarningsTab()}

      {/* Record Payment Modal */}
      <Modal visible={paymentModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Record Payment</Text>
            <Text style={s.modalSubtitle}>Enter the amount the driver paid to GoZo</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Amount (₹)"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
            />
            <TextInput
              style={[s.modalInput, { height: 72 }]}
              placeholder="Notes (optional)"
              placeholderTextColor={COLORS.textSecondary}
              multiline
              value={paymentNotes}
              onChangeText={setPaymentNotes}
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setPaymentModal(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirmBtn, recordingPayment && s.disabledBtn]}
                onPress={handleRecordPayment}
                disabled={recordingPayment}
              >
                {recordingPayment
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.modalConfirmText}>Record</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  backBtn: { paddingVertical: SPACING.xs, paddingRight: SPACING.sm },
  backBtnText: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
  headerName: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  headerPhone: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 1 },
  statusBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  activeTabLabel: { color: COLORS.primary },

  tabContent: { padding: SPACING.md, paddingBottom: 40 },

  // Action row
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: 8,
  },
  callBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  editBtn: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 44,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  cancelBtn: {
    borderRadius: BORDER_RADIUS.md,
    height: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 14 },
  disabledBtn: { opacity: 0.6 },

  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  debtCard: { borderColor: COLORS.primary + '40' },
  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },

  // Fields
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  fieldLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500', flex: 0.45 },
  fieldValue: { fontSize: 13, color: COLORS.white, fontWeight: '600', flex: 0.55, textAlign: 'right' },
  fieldEmpty: { color: COLORS.textSecondary, fontStyle: 'italic' },
  fieldInput: {
    flex: 0.55,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: COLORS.white,
    fontSize: 13,
    textAlign: 'right',
  },
  divider: { height: 1, backgroundColor: COLORS.border + '60' },

  // Earnings
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: SPACING.md },
  summaryCell: { width: '47%', backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.md, padding: 12 },
  summaryCellLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 4 },
  summaryCellValue: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  recordPaymentBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordPaymentBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Payment history
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  paymentDate: { fontSize: 13, color: COLORS.white, fontWeight: '600' },
  paymentNotes: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  paymentAmount: { fontSize: 15, fontWeight: '800', color: '#059669' },

  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },

  // Trip cards
  tripCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border + '80',
  },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  tripId: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '700' },
  tripDate: { fontSize: 11, color: COLORS.textSecondary },
  tripRoute: { fontSize: 13, color: COLORS.white, marginTop: 4 },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border + '40',
  },
  tripGoods: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  tripPriceBlock: { alignItems: 'flex-end' },
  tripDriverEarning: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  tripGozoCut: { fontSize: 11, color: '#F59E0B', fontWeight: '600', marginTop: 1 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  errorText: { color: COLORS.cancelled, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  retryBtn: { marginTop: 12, backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: COLORS.white, fontWeight: '700' },
  emptyContainer: { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, fontStyle: 'italic' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.md },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    color: COLORS.white,
    fontSize: 15,
    marginBottom: SPACING.sm,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: SPACING.sm },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '700' },
  modalConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

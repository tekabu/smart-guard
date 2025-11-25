import admin from "firebase-admin";
import { getRealtimeDb } from "./realtimeDb.js";

/**
 * Security Module for SmartGuard System
 * Handles emergency unlocks, user blocking, and audit logging
 */

// ============================================
// AUDIT LOGGING
// ============================================

export interface AuditLog {
  timestamp: string;
  type: 'access' | 'admin_action' | 'system_change';
  action: string;
  user: string;
  target?: string;
  details: string;
  ip_address?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export async function addAuditLog(log: AuditLog): Promise<string> {
  const rtdb = getRealtimeDb();
  const auditRef = rtdb.ref('audit_logs');
  const newLogRef = auditRef.push();
  
  await newLogRef.set({
    ...log,
    timestamp: log.timestamp || new Date().toISOString(),
    severity: log.severity || 'low'
  });
  
  return newLogRef.key!;
}

export async function getAuditLogs(limit: number = 100, filters?: {
  type?: string;
  user?: string;
  startDate?: string;
  endDate?: string;
}): Promise<any[]> {
  const rtdb = getRealtimeDb();
  let query: any = rtdb.ref('audit_logs').orderByChild('timestamp').limitToLast(limit);
  
  const snapshot = await query.once('value');
  const logs: any[] = [];
  
  snapshot.forEach((child: any) => {
    const log = { id: child.key, ...child.val() };
    
    // Apply filters
    if (filters) {
      if (filters.type && log.type !== filters.type) return;
      if (filters.user && !log.user.includes(filters.user)) return;
      if (filters.startDate && log.timestamp < filters.startDate) return;
      if (filters.endDate && log.timestamp > filters.endDate) return;
    }
    
    logs.push(log);
  });
  
  return logs.reverse(); // Most recent first
}

export async function exportAuditLogs(filters?: any): Promise<string> {
  const logs = await getAuditLogs(1000, filters);
  
  // Convert to CSV
  const headers = ['Timestamp', 'Type', 'Action', 'User', 'Target', 'Details', 'Severity'];
  const rows = logs.map(log => [
    log.timestamp,
    log.type,
    log.action,
    log.user,
    log.target || '',
    log.details,
    log.severity || 'low'
  ]);
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csv;
}

// ============================================
// EMERGENCY UNLOCK
// ============================================

export interface EmergencyUnlock {
  id?: string;
  timestamp: string;
  admin: string;
  reason: string;
  doors: string[];
  duration: number; // seconds
  auto_locked_at?: string;
  status: 'active' | 'completed';
}

export async function triggerEmergencyUnlock(
  admin: string,
  reason: string,
  duration: number = 300 // 5 minutes default
): Promise<string> {
  const rtdb = getRealtimeDb();
  
  // Create emergency unlock record
  const unlockRef = rtdb.ref('security/emergency_unlocks').push();
  const unlockData: EmergencyUnlock = {
    timestamp: new Date().toISOString(),
    admin,
    reason,
    doors: ['all'],
    duration,
    status: 'active'
  };
  
  await unlockRef.set(unlockData);
  
  // Send command to hardware
  await rtdb.ref('hardware/commands/emergency_unlock').set({
    active: true,
    duration,
    timestamp: Date.now(),
    admin
  });
  
  // Log the action
  await addAuditLog({
    timestamp: new Date().toISOString(),
    type: 'admin_action',
    action: 'emergency_unlock',
    user: admin,
    target: 'all_doors',
    details: `Emergency unlock activated: ${reason}`,
    severity: 'critical'
  });
  
  // Set auto-lock timer
  setTimeout(async () => {
    await autoLockAfterEmergency(unlockRef.key!);
  }, duration * 1000);
  
  return unlockRef.key!;
}

async function autoLockAfterEmergency(unlockId: string): Promise<void> {
  const rtdb = getRealtimeDb();
  
  // Update emergency unlock record
  await rtdb.ref(`security/emergency_unlocks/${unlockId}`).update({
    auto_locked_at: new Date().toISOString(),
    status: 'completed'
  });
  
  // Send lock command to hardware
  await rtdb.ref('hardware/commands/emergency_unlock').set({
    active: false,
    timestamp: Date.now()
  });
  
  // Log the auto-lock
  await addAuditLog({
    timestamp: new Date().toISOString(),
    type: 'system_change',
    action: 'auto_lock',
    user: 'system',
    target: 'all_doors',
    details: 'Doors auto-locked after emergency unlock timeout',
    severity: 'medium'
  });
}

export async function getEmergencyUnlocks(limit: number = 50): Promise<EmergencyUnlock[]> {
  const rtdb = getRealtimeDb();
  const snapshot = await rtdb.ref('security/emergency_unlocks')
    .orderByChild('timestamp')
    .limitToLast(limit)
    .once('value');
  
  const unlocks: EmergencyUnlock[] = [];
  snapshot.forEach((child: any) => {
    unlocks.push({ id: child.key, ...child.val() });
  });
  
  return unlocks.reverse();
}

// ============================================
// USER BLOCKING
// ============================================

export interface BlockedUser {
  id?: string;
  userId: string;
  userName?: string;
  blocked: boolean;
  reason: string;
  blocked_by: string;
  blocked_at: string;
  unblock_at?: string; // null for permanent
  block_type: 'temporary' | 'permanent';
  duration?: number; // minutes for temporary blocks
}

export async function blockUser(
  userId: string,
  blockedBy: string,
  reason: string,
  blockType: 'temporary' | 'permanent' = 'permanent',
  duration?: number // minutes
): Promise<string> {
  const rtdb = getRealtimeDb();
  const db = admin.firestore();
  
  const blockedAt = new Date().toISOString();
  let unblockAt: string | undefined;
  
  if (blockType === 'temporary' && duration) {
    const unblockDate = new Date(Date.now() + duration * 60 * 1000);
    unblockAt = unblockDate.toISOString();
  }
  
  // Get user name
  let userName = userId;
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      userName = userDoc.data()?.name || userId;
    }
  } catch (error) {
    console.error('Error fetching user name:', error);
  }
  
  // Add to blocked users in Realtime DB
  const blockRef = rtdb.ref('security/blocked_users').push();
  const blockData: BlockedUser = {
    userId,
    userName,
    blocked: true,
    reason,
    blocked_by: blockedBy,
    blocked_at: blockedAt,
    unblock_at: unblockAt,
    block_type: blockType,
    duration
  };
  
  await blockRef.set(blockData);
  
  // Also update user document in Firestore
  try {
    await db.collection('users').doc(userId).update({
      blocked: true,
      blocked_at: blockedAt,
      blocked_reason: reason
    });
  } catch (error) {
    console.error('Error updating user in Firestore:', error);
  }
  
  // Log the block action
  await addAuditLog({
    timestamp: blockedAt,
    type: 'admin_action',
    action: 'block_user',
    user: blockedBy,
    target: userId,
    details: `User blocked: ${reason} (${blockType})`,
    severity: 'high'
  });
  
  // Set auto-unblock timer for temporary blocks
  if (blockType === 'temporary' && duration) {
    setTimeout(async () => {
      await unblockUser(userId, 'system', 'Temporary block expired');
    }, duration * 60 * 1000);
  }
  
  return blockRef.key!;
}

export async function unblockUser(
  userId: string,
  unblockedBy: string,
  reason: string
): Promise<void> {
  const rtdb = getRealtimeDb();
  const db = admin.firestore();
  
  // Find and remove from blocked users
  const snapshot = await rtdb.ref('security/blocked_users')
    .orderByChild('userId')
    .equalTo(userId)
    .once('value');
  
  const updates: any = {};
  snapshot.forEach((child: any) => {
    updates[`security/blocked_users/${child.key}`] = null;
  });
  
  await rtdb.ref().update(updates);
  
  // Update user document in Firestore
  try {
    await db.collection('users').doc(userId).update({
      blocked: false,
      unblocked_at: new Date().toISOString(),
      unblocked_by: unblockedBy
    });
  } catch (error) {
    console.error('Error updating user in Firestore:', error);
  }
  
  // Log the unblock action
  await addAuditLog({
    timestamp: new Date().toISOString(),
    type: 'admin_action',
    action: 'unblock_user',
    user: unblockedBy,
    target: userId,
    details: `User unblocked: ${reason}`,
    severity: 'medium'
  });
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const rtdb = getRealtimeDb();
  const snapshot = await rtdb.ref('security/blocked_users')
    .orderByChild('blocked')
    .equalTo(true)
    .once('value');
  
  const blockedUsers: BlockedUser[] = [];
  snapshot.forEach((child: any) => {
    blockedUsers.push({ id: child.key, ...child.val() });
  });
  
  return blockedUsers;
}

export async function isUserBlocked(userId: string): Promise<boolean> {
  const rtdb = getRealtimeDb();
  const snapshot = await rtdb.ref('security/blocked_users')
    .orderByChild('userId')
    .equalTo(userId)
    .once('value');
  
  let blocked = false;
  snapshot.forEach((child: any) => {
    if (child.val().blocked === true) {
      blocked = true;
    }
  });
  
  return blocked;
}

// ============================================
// THREAT DETECTION
// ============================================

export async function detectBruteForce(userId: string, timeWindow: number = 300): Promise<boolean> {
  const rtdb = getRealtimeDb();
  const now = Date.now();
  const windowStart = now - (timeWindow * 1000);
  
  // Get failed attempts in time window
  const snapshot = await rtdb.ref('accessLogs')
    .orderByChild('timestamp')
    .startAt(windowStart)
    .once('value');
  
  let failedAttempts = 0;
  snapshot.forEach((child: any) => {
    const log = child.val();
    if (log.userId === userId && log.result === 'Denied') {
      failedAttempts++;
    }
  });
  
  // Threshold: 5 failed attempts in 5 minutes
  if (failedAttempts >= 5) {
    await addAuditLog({
      timestamp: new Date().toISOString(),
      type: 'system_change',
      action: 'brute_force_detected',
      user: 'system',
      target: userId,
      details: `Brute force attack detected: ${failedAttempts} failed attempts in ${timeWindow}s`,
      severity: 'critical'
    });
    
    return true;
  }
  
  return false;
}

export async function autoBlockOnThreat(userId: string, reason: string): Promise<void> {
  await blockUser(userId, 'system', reason, 'temporary', 60); // Block for 1 hour
  
  await addAuditLog({
    timestamp: new Date().toISOString(),
    type: 'system_change',
    action: 'auto_block',
    user: 'system',
    target: userId,
    details: `User auto-blocked due to: ${reason}`,
    severity: 'critical'
  });
}

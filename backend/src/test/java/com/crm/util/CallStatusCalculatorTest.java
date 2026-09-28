package com.crm.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CallStatusCalculatorTest {

    @Test
    @DisplayName("Case 1: Answered + 15 sec -> JUNK")
    void testCase1_Answered15Sec() {
        String status = CallStatusCalculator.calculateStatus(true, 15);
        assertEquals(CallStatusCalculator.JUNK, status);
    }

    @Test
    @DisplayName("Case 2: Answered + 30 sec -> CONNECTED")
    void testCase2_Answered30Sec() {
        String status = CallStatusCalculator.calculateStatus(true, 30);
        assertEquals(CallStatusCalculator.CONNECTED, status);
    }

    @Test
    @DisplayName("Case 3: Answered + 2 min (120 sec) -> CONNECTED")
    void testCase3_Answered2Min() {
        String status = CallStatusCalculator.calculateStatus(true, 120);
        assertEquals(CallStatusCalculator.CONNECTED, status);
    }

    @Test
    @DisplayName("Case 4: Answered + exactly 5 min (300 sec) -> CONNECTED")
    void testCase4_Answered5MinExactly() {
        String status = CallStatusCalculator.calculateStatus(true, 300);
        assertEquals(CallStatusCalculator.CONNECTED, status);
    }

    @Test
    @DisplayName("Case 5: Answered + 5 min 1 sec (301 sec) -> PROSPECT")
    void testCase5_Answered5Min1Sec() {
        String status = CallStatusCalculator.calculateStatus(true, 301);
        assertEquals(CallStatusCalculator.PROSPECT, status);
    }

    @Test
    @DisplayName("Case 6: Answered + 10 min (600 sec) -> PROSPECT")
    void testCase6_Answered10Min() {
        String status = CallStatusCalculator.calculateStatus(true, 600);
        assertEquals(CallStatusCalculator.PROSPECT, status);
    }

    @Test
    @DisplayName("Case 7: Not answered + 10 sec ringing -> MISSED")
    void testCase7_NotAnswered10SecRinging() {
        String status = CallStatusCalculator.calculateStatus(false, 10);
        assertEquals(CallStatusCalculator.MISSED, status);
    }

    @Test
    @DisplayName("Case 8: Not answered + 35 sec ringing -> MISSED")
    void testCase8_NotAnswered35SecRinging() {
        String status = CallStatusCalculator.calculateStatus(false, 35);
        assertEquals(CallStatusCalculator.MISSED, status);
    }

    @Test
    @DisplayName("Case 9: Not answered + 60 sec ringing -> MISSED")
    void testCase9_NotAnswered60SecRinging() {
        String status = CallStatusCalculator.calculateStatus(false, 60);
        assertEquals(CallStatusCalculator.MISSED, status);
    }

    @Test
    @DisplayName("Case 10: Rejected immediately -> MISSED")
    void testCase10_RejectedImmediately() {
        String status = CallStatusCalculator.calculateStatus(false, 0);
        assertEquals(CallStatusCalculator.MISSED, status);
    }
}

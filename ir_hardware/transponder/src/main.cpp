#include <Arduino.h>
#include <IRremote.hpp>

// ==========================================
// CONFIGURATION
// Change this ID for each different car!
const uint16_t TRANSPONDER_ID = 42; 
// ==========================================

// For ATtiny85, Pin PB1 corresponds to physical Pin 6 on the DIP chip.
// This is the default timer pin for IRremote.
#define IR_SEND_PIN 1

void setup() {
  // Initialize IR Sender.
  // 38kHz is the carrier frequency required for TSOP38238 receivers.
  IrSender.begin(IR_SEND_PIN); 
}

void loop() {
  // Transmit the ID using the robust NEC protocol.
  // Address = 0x00, Command = TRANSPONDER_ID, Repeats = 0
  IrSender.sendNEC(0x00, TRANSPONDER_ID, 0);
  
  // Wait before sending again. 
  // 30ms delay gives ~33Hz update rate (faster than 30fps camera),
  // while ensuring we don't spam the airwaves and jam other cars.
  delay(30); 
}

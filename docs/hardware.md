# Hardware Setup Guide

LapCounter Pro uses a combination of an ESP32 for the Sensor Bar and ATtiny45 chips for the Droid Transponders. 

## 1. Droid Transponders (ATtiny45)
Each participating droid requires an active IR transponder.
- **Microcontroller**: ATtiny45V-10PU (Low-voltage version prevents brown-outs on coin cell batteries).
- **IR LED**: TSAL6400 (High-power, narrow beam IR emitter).
- **Wiring**: The IR LED must be connected to **PB1 (Pin 6)** on the ATtiny. It is highly recommended to drive the LED via a small NPN transistor (like a 2N2222) instead of connecting it directly. This allows the battery to send high-current power to the LED without frying the ATtiny chip.
- **Flashing the Code**: You don't need any complex programming software! LapCounter Pro has a built-in flashing tool.
  1. Plug your USBasp or SparkFun Tiny AVR Programmer directly into the Raspberry Pi's USB port.
  2. Insert the ATtiny chip into the programmer.
  3. Open the **LapCounter Web Dashboard** on your laptop/phone and navigate to the **Settings** tab.
  4. Under the "Hardware Programming" section, type in the desired Transponder ID and click **Flash ATtiny**. The Pi will compile and flash the chip for you automatically!

## 2. Sensor Bar (ESP32)
The Sensor Bar sits at the finish line and detects the IR pulses from the passing droids.
- **Microcontroller**: ESP32 (e.g., NodeMCU or DevKitC).
- **IR Receivers**: TSOP38238 or VS1838B. 
- **Daisy-Chaining**: To cover a wide finish line, you can wire multiple IR receivers in parallel. Connect all of their `OUT` signal pins to **GPIO 15** on the ESP32. 
- **Physical Build**: The sensor bar is typically constructed as a long plastic or PVC tube spanning the width of the finish line, with the IR receivers mounted along its length and the ESP32 housed at one end.
- **Baffles**: It is critical to build physical baffles (e.g., using black cardboard or 3D printed tubes protruding from the main tube) around each IR receiver so they only "see" straight down. Without baffles, the sensors will detect IR reflections from walls and ceilings, causing false laps.
- **Placement & Height**: Mount the sensor bar directly overhead at the finish line, suspended high enough so that the tallest droid can safely pass underneath without hitting it. Since the TSAL6400 IR emitters on the droids are very powerful, the sensor bar can be placed several feet above the track, provided the receivers are pointing straight down.
- **Connection to Pi**: The ESP32 must be connected directly to the Raspberry Pi via a USB cable. The Raspberry Pi will read the incoming IR pulses over this serial USB connection while simultaneously providing power to the ESP32 and the sensor bar array.

## 3. LCD Screen (DFRobot DFR0514)
The system uses the DFRobot I2C 16x2 RGB LCD Keypad Shield to display system status and IP addresses right on the finish line.
- **Physical Install**: Carefully align the pins and push the LCD HAT directly onto the Raspberry Pi's GPIO headers.
- **CRITICAL - JUMPER CAPS**: Look closely at the top of the LCD board next to the buttons. You will see a small block of metal pins. You **MUST** install the 5 small black plastic "jumper caps" (included in the box) across these pins to physically connect the buttons to the Pi. If you leave these off, the buttons will do absolutely nothing when pressed.
- The `lapcounter-lcd.service` will automatically initialize the screen on boot and handle button presses.

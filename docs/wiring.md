# Wiring Diagrams

Below are the logical wiring diagrams for the custom hardware components in the LapCounter Pro system.

## Droid Transponder (ATtiny45)

The transponder flashes a unique 38kHz IR signal identifying the droid. It is highly recommended to drive the high-power TSAL6400 IR LED using an NPN transistor rather than connecting it directly to the ATtiny pin.

```mermaid
graph TD
    subgraph "Power"
    BATT[Battery 3.0V - 4.2V]
    end

    subgraph "ATtiny45V-10PU"
    VCC[Pin 8: VCC]
    GND1[Pin 4: GND]
    PB1[Pin 6: PB1 / PWM]
    end

    subgraph "IR Emission Circuit"
    R1[Base Resistor: 330Ω]
    Q1[NPN Transistor: 2N2222]
    LED[IR LED: TSAL6400]
    R2[Current Limiting: 10Ω - 47Ω]
    end

    BATT -- "+" --> VCC
    BATT -- "-" --> GND1
    
    PB1 --> R1
    R1 -->|Base| Q1
    
    BATT -- "+" --> R2
    R2 -->|Anode| LED
    LED -->|Cathode| Q1
    Q1 -->|Emitter| GND1
```

## Sensor Bar (ESP32)

The sensor bar receives the IR signals. You can wire multiple IR receivers in parallel (daisy-chain) to a single GPIO pin to widen the detection area of the finish line.

```mermaid
graph TD
    subgraph "ESP32 Controller"
    E_3V3[3.3V Out]
    E_GND[GND]
    E_GPIO[GPIO 15]
    E_PULLUP[Internal Pull-Up enabled]
    end

    subgraph "IR Receiver 1 (e.g. VS1838B)"
    IR1_VCC[VCC]
    IR1_GND[GND]
    IR1_OUT[OUT]
    end

    subgraph "IR Receiver 2"
    IR2_VCC[VCC]
    IR2_GND[GND]
    IR2_OUT[OUT]
    end

    E_3V3 --> IR1_VCC
    E_GND --> IR1_GND
    IR1_OUT --> E_GPIO
    
    E_3V3 --> IR2_VCC
    E_GND --> IR2_GND
    IR2_OUT --> E_GPIO
```

*Note: For maximum reliability when daisy-chaining many IR receivers, place a diode (like 1N4148) on each OUT pin pointing towards the sensor, and add a single 10k pull-up resistor from GPIO 15 to 3.3V on the ESP32.*

## LCD Display (DFRobot DFR0514)

The DFRobot I2C 16x2 RGB LCD Keypad Shield is a HAT that sits directly on top of the Raspberry Pi.

```mermaid
graph LR
    subgraph "Raspberry Pi GPIO Header"
    P_5V[5V Power]
    P_GND[Ground]
    P_SDA[Pin 3: SDA / GPIO 2]
    P_SCL[Pin 5: SCL / GPIO 3]
    P_BTN1[Pin 36: GPIO 16]
    P_BTN2[Pin 11: GPIO 17]
    P_BTN3[Pin 12: GPIO 18]
    end

    subgraph "DFRobot Shield"
    S_I2C[I2C Interface]
    S_JUMP[Jumper Block]
    S_BTNS[Push Buttons]
    end

    P_5V --> S_I2C
    P_GND --> S_I2C
    P_SDA <--> S_I2C
    P_SCL --> S_I2C

    S_BTNS --> S_JUMP
    S_JUMP -.->|Jumper Caps Required| P_BTN1
    S_JUMP -.->|Jumper Caps Required| P_BTN2
    S_JUMP -.->|Jumper Caps Required| P_BTN3
```

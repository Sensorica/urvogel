# urvogel
Chickens on a Chain - Eris/IoT

## Hardware Requirements
* Raspberry Pi 2/Pi 3
* [NFC/RFID reader](https://www.adafruit.com/product/364)
* [NFC/RFID tags][Amazon NFC stickers]

[Amazon NFC stickers]: https://www.amazon.com/gp/product/B01D8RDNZ0/ref=oh_aui_detailpage_o07_s00?ie=UTF8&psc=1

## Software Requirement
* [Hypriot Docker](http://blog.hypriot.com/downloads/)
* [eris Blockchain tools](https://erisindustries.com/)

## Dependency Projects
* [node-nfc](https://github.com/camme/node-nfc)

## Try The Code
### Throw in your eggs
```bash
sudo node eggs.js
```

And place the tag to the reader, you'll see the eggs number goes up.

## To Contribute
### Project structure
- `apps`: This folder contains separate RFID node/js applications. 
  - `consumer`: The egg consumer (Ex. egg lover) side application.
  - `producer`: The egg producer (Ex. farmer) side application.
  - `egg_rfid`: Test apps for egg chain and rfid read and write.
- `contracts`: This folder contains all the contracts for the apps. 

   And each subfolder includes the contract compilation output such as `abi` and `epm.json`.
   Also you can put the `accounts.json` here to feed your apps.

## Known Problems
0. The `node-nfc` node dependency has issue with the `nfc.parse` function. 

   You can pull the [forked node-nfc repo](https://github.com/shuangjj/node-nfc),  
   which fixed the problem and build the module by `node-gyp`.


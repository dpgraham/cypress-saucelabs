# CYPRESS SAUCE LABS

```bash
cypress-saucelabs 
  <same as run args for cypress>
  --browser Chrome # Chrome on Windows by default
  --platform-name "Windows 7|macOS 10.15|etc..."
  --browsers sauce-browsers.json # Run a list of browsers defined in JSON
  --parallel # Not supported. Ask for it on Sauce Labs Aha board
  --concurrency 5 # Defaults to 2
  --
```

# IMPLEMENTATION
* Use "sauce-browsers.json" to generate sauce config.yml
* Take the command line arguments and construct a special "cypress-<unique-hash>.json" that goes with the payload
* Generate a ".sauceignore" file
* Add these files, plus all files in the root, minus what is defined in ".sauceignore"

# USABILITY

# EXAMPLES
* monorepo
* viewports
* screen-resolutions
* cross-browser
* 
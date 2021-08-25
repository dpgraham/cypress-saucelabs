# cypress-saucelabs

Run your Cypress scripts in the Sauce Labs Cloud and take advantage of Sauce Labs many browsers and platforms to run your Cypress tests on.

## Pre-requisites
You already have Cypress tests set up.

See https://docs.cypress.io/guides/getting-started/installing-cypress to get started with Cypress.

## Getting Started
* Register an account at saucelabs.com/sign-up
* Copy your Sauce access key from https://app.saucelabs.com/user-settings (remember to keep this a secret)
* Run your Cypress tests on the Sauce Labs cloud

```bash
# Example tests running on Chrome, Firefox and Edge 
npm install -g cypress-saucelabs
cd /path/to/cypress/project
cypress-saucelabs --sauce-access-key <YOUR_ACCESS_KEY> 
  --sauce-username <YOUR_USERNAME>
  --browser "chrome,firefox,microsoftedge"
```

`cypress-saucelabs` runs the same commands as 

## Examples

(TODO: Link to a wider array of examples)

## Development

Try it locally by running `node . --browser "microsoftedge:latest:Windows 10:800x600,chrome" --config foo=bar --project examples/local --tunnel`

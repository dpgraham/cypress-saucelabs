# cypress-saucelabs

Run your Cypress scripts in the Sauce Labs Cloud and take advantage of Sauce Labs many browsers and platforms to run your Cypress tests in parallel on.

## Pre-requisites
You already have Cypress tests set up.

See https://docs.cypress.io/guides/getting-started/installing-cypress to get started with Cypress.

## Getting Started
* Register an account at https://saucelabs.com/sign-up
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

## Description

`cypress-saucelabs` is the same as `cypress run` except with additional command-line flags to facilitate running your tests in the Sauce cloud

```bash
  -u, --sauce-username, --username          your Sauce Labs username. you can
                                            omit this if you set a
                                            SAUCE_USERNAME environment variable
                                                                        [string]
  -a, --sauce-access-key                    your Sauce Labs access key. you can
                                            omit this if you set a
                                            SAUCE_ACCESS_KEY environment
                                            variable                    [string]
      --sauce-local                         run your Cypress test locally and
                                            send the results to Sauce Labs
                                                                       [boolean]
      --sauce-cypress-version               version of Cypress to run in cloud.
                                            Default is 7.1.0            [string]
      --sauce-concurrency, --ccy,           max number of jobs to run
      --concurrency                         concurrently                [number]
      --sauce-region, --region              data center to run tests from. Can
                                            be US (United States) or EU (Europe)
                                                                        [string]
      --sauce-tunnel, --tunnel              open up a SauceConnect tunnel so
                                            that the Sauce Labs VM can access
                                            localhost                  [boolean]
      --sauce-config                        a js or json file that can be used
                                            to define a group of jobs   [string]
```

## Examples

(TODO: Link to a wider array of examples)

## Development

Try it locally by running `node . --browser "microsoftedge:latest:Windows 10:800x600,chrome"`

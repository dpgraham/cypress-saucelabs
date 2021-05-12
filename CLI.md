Usage: cypress-saucelabs [options]

Runs Cypress tests in the Sauce Labs cloud

***Register for a FREE Sauce Labs account at http://saucelabs.com/sign-up !***

Options:
  --sauce-username                           your Sauce Labs username (see documentation). you can omit this if you set a SAUCE_USERNAME
                                             environment variable. Register for a FREE Sauce Labs account at saucelabs.com/sign-up !
  --sauce-access-key                         your Sauce Labs access key (see documentation). you can omit this if you set a SAUCE_ACCESS_KEY
                                             environment variable. Register for a FREE Sauce Labs account at saucelabs.com/sign-up !
  --sauce-browsers                           a comma-separted list of Sauce Labs browsers to run your Cypress tests on.
                                             example: "--sauce-browsers chrome, firefox:78:windows , edge:latest:windows"
  --sauce-local [bool]                       run Cypress locally and retain assets in Sauce Labs cloud
  --sauce-cypress-version                    version of Cypress

  -b, --browser <browser-name-or-path>       runs Cypress in the browser with the given name. if a filesystem path is supplied, Cypress
                                             will attempt to use the browser at that path.
  --ci-build-id <id>                         the unique identifier for a run on your CI provider. typically a "BUILD_ID" env var. this
                                             value is automatically detected for most CI providers
  -c, --config <config>                      sets configuration values. separate multiple values with a comma. overrides any value in
                                             cypress.json.
  -C, --config-file <config-file>            path to JSON file where configuration values are set. defaults to "cypress.json". pass
                                             "false" to disable.
  -e, --env <env>                            sets environment variables. separate multiple values with a comma. overrides any value in
                                             cypress.json or cypress.env.json
  --group <name>                             a named group for recorded runs in the Cypress Dashboard
  -k, --key <record-key>                     your secret Record Key. you can omit this if you set a CYPRESS_RECORD_KEY environment
                                             variable.
  --headed                                   displays the browser instead of running headlessly (defaults to true for Firefox and
                                             Chromium-family browsers)
  --headless                                 hide the browser instead of running headed (defaults to true for Electron)
  --no-exit                                  keep the browser open after tests finish
  --parallel                                 enables concurrent runs and automatic load balancing of specs across multiple machines or
                                             processes
  -p, --port <port>                          runs Cypress on a specific port. overrides any value in cypress.json.
  -P, --project <project-path>               path to the project
  -q, --quiet                                run quietly, using only the configured reporter
  --record [bool]                            records the run. sends test results, screenshots and videos to your Cypress Dashboard.
  -r, --reporter <reporter>                  runs a specific mocha reporter. pass a path to use a custom reporter. defaults to "spec"
  -o, --reporter-options <reporter-options>  options for the mocha reporter. defaults to "null"
  -s, --spec <spec>                          runs specific spec file(s). defaults to "all"
  -t, --tag <tag>                            named tag(s) for recorded runs in the Cypress Dashboard
  --dev                                      runs cypress in development and bypasses binary check
  -h, --help                                 output usage information
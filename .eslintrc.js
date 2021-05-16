module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es2021": true
    },
    "extends": [
        "eslint-config-appium"
    ],
    "parserOptions": {
        "ecmaVersion": 12
    },
    "rules": {
        "promise/no-native": "off",
        "promise/prefer-await-to-then": "off"
    }
};

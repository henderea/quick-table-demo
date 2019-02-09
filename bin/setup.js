#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const jsdiff = require('diff');
const chalk = require('chalk');
const inquirer = require('inquirer');

const projName = path.basename(path.join(__dirname, '..'));

function showDiff(oldSrc, newSrc, name) {
    console.log(chalk.bold(name));
    const diff = jsdiff.diffLines(oldSrc, newSrc);
    const hasChanges = _.some(diff, part => part.added || part.removed);
    if(hasChanges) {
        console.log(_.compact(_.map(diff, (part) => {
            const color = part.added ? chalk.green : part.removed ? chalk.red : null;
            if(color) {
                return color(part.value.replace(/\n$/g, ''));
            } else {
                return null;
            }
        })).join('\n'));
    } else {
        console.log('No changes');
    }
}

function confirmSave() {
    var p = inquirer.createPromptModule();
    return p({
        type: 'confirm',
        name: 'save',
        message: 'Save the changes?',
        default: false
    }).then(answers => answers.save);
}

var prompt = inquirer.createPromptModule();
const questions = [
    {
        name: 'baseName',
        type: 'input',
        message: 'Name to go in package.json',
        default: projName
    },
    {
        name: 'desc',
        type: 'input',
        message: 'Description to go in package.json'
    },
    {
        name: 'addDeploy',
        type: 'confirm',
        message: 'Add a "yarn deploy" command?',
        default: false
    },
    {
        name: 'repo',
        type: 'input',
        message: 'Repository url to go in package.json (optional)'
    },
    {
        name: 'nowName',
        type: 'input',
        message: 'Name to go in now.json',
        default: projName
    },
    {
        name: 'public',
        type: 'confirm',
        message: 'Make now sources and logs public?',
        default: false
    },
    {
        name: 'alias',
        type: 'input',
        message: 'Alias for now deployments (optional)'
    }
];

prompt(questions).then(answers => {
    let packageJsonSrc = fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8');
    let nowJsonSrc = fs.readFileSync(path.join(__dirname, '../now.json'), 'utf8');
    let packageJson = JSON.parse(packageJsonSrc);
    let nowJson = JSON.parse(nowJsonSrc);
    packageJson.name = answers.baseName;
    packageJson.description = answers.desc;
    if(answers.addDeploy) {
        if(answers.alias && answers.alias != '') {
            packageJson.scripts.deploy = `now && now alias && now rm ${answers.nowName} --safe --yes`;
        } else {
            packageJson.scripts.deploy = `now`;
        }
    }
    if(answers.repo && answers.repo != '') {
        packageJson.repository = answers.repo;
    } else {
        packageJson.repository = '';
    }
    nowJson.name = answers.nowName;
    nowJson.public = answers.public;
    if(answers.alias && answers.alias != '') {
        nowJson.alias = answers.alias;
    }
    let packageJsonDest = JSON.stringify(packageJson, null, 2);
    let nowJsonDest = JSON.stringify(nowJson, null, 4);
    showDiff(packageJsonSrc, packageJsonDest, 'package.json');
    confirmSave().then(save => {
        if(save) {
            fs.writeFileSync(path.join(__dirname, '../package.json'), packageJsonDest);
        }
        showDiff(nowJsonSrc, nowJsonDest, 'now.json');
        confirmSave().then(save => {
            if(save) {
                fs.writeFileSync(path.join(__dirname, '../now.json'), nowJsonDest);
            }
        });
    });
});
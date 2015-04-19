#!/usr/bin/env node

var childProcess = require('child_process');
var Promise = require('bluebird');
var _ = require('lodash');
var chokidar = require('chokidar');
var utils = require('./utils');


var EVENT_DESCRIPTIONS = {
    add: 'Added file',
    addDir: 'Added directory',
    unlink: 'Removed file',
    unlinkDir: 'Removed directory',
    change: 'Changed file'
};

var defaultOpts = {
    debounce: 400,
    followSymlinks: false,
    ignore: null,
    polling: false,
    pollInterval: 100,
    pollIntervalBinary: 300,
    verbose: false,
    initial: false
};

var VERSION = 'chokidar-cli: ' + require('./package.json').version +
              '\nchokidar: ' + require('chokidar/package').version;

var argv = require('yargs')
    .usage(
        'Usage: $0 <pattern> <command> [options]\n\n' +
        '<pattern>:\n' +
        'Glob pattern to specify files to be watched.\n' +
        'Needs to be surrounded with quotes to prevent shell globbing.\n' +
        'Guide to globs: https://github.com/isaacs/node-glob#glob-primer\n\n' +
        '<command>:\n' +
        'Command to be executed when a change is detected.\n' +
        'Needs to be surrounded with quotes when command contains spaces'
    )
    .example('$0 "**/*.js" "npm run build-js"', 'build when any .js file changes')
    .demand(2)
    .option('d', {
        alias: 'debounce',
        default: defaultOpts.debounce,
        describe: 'Debounce timeout in ms for executing command',
        type: 'number'
    })
    .option('s', {
        alias: 'follow-symlinks',
        default: defaultOpts.followSymlinks,
        describe: 'When not set, only the symlinks themselves will be watched ' +
                  'for changes instead of following the link references and ' +
                  'bubbling events through the links path',
        type: 'boolean'
    })
    .option('i', {
        alias: 'ignore',
        describe: 'Pattern for files which should be ignored. ' +
                  'Needs to be surrounded with quotes to prevent shell globbing. ' +
                  'The whole relative or absolute path is tested, not just filename'
    })
    .option('initial', {
        describe: 'When set, command is initially run once',
        default: defaultOpts.initial,
        type: 'boolean'
    })
    .option('p', {
        alias: 'polling',
        describe: 'Whether to use fs.watchFile(backed by polling) instead of ' +
                  'fs.watch. This might lead to high CPU utilization. ' +
                  'It is typically necessary to set this to true to ' +
                  'successfully watch files over a network, and it may be ' +
                  'necessary to successfully watch files in other ' +
                  'non-standard situations',
        default: defaultOpts.polling,
        type: 'boolean'
    })
    .option('poll-interval', {
        describe: 'Interval of file system polling. Effective when --polling ' +
                  'is set',
        default: defaultOpts.pollInterval,
        type: 'number'
    })
    .option('poll-interval-binary', {
        describe: 'Interval of file system polling for binary files. ' +
                  'Effective when --polling is set',
        default: defaultOpts.pollIntervalBinary,
        type: 'number'
    })
    .option('verbose', {
        describe: 'When set, output is more verbose',
        default: defaultOpts.verbose,
        type: 'boolean'
    })
    .help('h')
    .alias('h', 'help')
    .alias('v', 'version')
    .version(VERSION)
    .argv;


function main() {
    var userOpts = getUserOpts(argv);
    var opts = _.merge(defaultOpts, userOpts);
    startWatching(opts);
}

function getUserOpts(argv) {
    argv.pattern = argv._[0];
    argv.command = argv._[1];
    return argv;
}

// Estimates spent working hours based on commit dates
function startWatching(opts) {
    var chokidarOpts = createChokidarOpts(opts);
    var watcher = chokidar.watch(opts.pattern, chokidarOpts);

    var debouncedRun = _.debounce(run, opts.debounce);
    watcher.on('all', function(event, path) {
        var description = EVENT_DESCRIPTIONS[event] + ':';

        if (opts.verbose) console.log(description, path);

        // TODO: commands might be still run concurrently
        debouncedRun(opts.command);
    });

    watcher.on('error', function(error) {
        console.error('Error:', error);
        console.error(error.stack);
    });

    watcher.on('ready', function() {
        console.log('Watching', '"' + opts.pattern + '" ..');
    });
}

function createChokidarOpts(opts) {
    var chokidarOpts = {
        followSymlinks: opts.followSymlinks,
        usePolling: opts.polling,
        interval: opts.pollInterval,
        binaryInterval: opts.pollIntervalBinary,
        ignoreInitial: !opts.initial
    };
    if (opts.ignore) chokidarOpts.ignore = opts.ignore;

    return chokidarOpts;
}

function run(cmd) {
    return utils.run(cmd)
    .catch(function(err) {
        console.error('Error when executing', cmd);
        console.error(err.stack);
    });
}

main();

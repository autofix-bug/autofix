// Copyright © 2020 Wei Zhang (Charmve).
// The following code is covered by the MIT license.

const os = require('os');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

exports.register = async (fixers) => {
  // TODO: This only lists versions of Java. Maybe we also want to upgrade other SDKMAN tools?
  //   (E.g. Ant, Gradle, Groovy, Kotlin, Maven, Scala, Spark, Spring Boot, Tomcat, etc.)
  const { stdout, stderr } = await exec('bash -lc ". $HOME/.sdkman/bin/sdkman-init.sh && yes | sdk update 2>&1" && bash -lc ". $HOME/.sdkman/bin/sdkman-init.sh && sdk list java"');
  if (stderr) {
    throw stderr;
  }

  const patchVersionReplacements = {};
  for (const line of stdout.split('\n').reverse()) {
    const cols = line.split('|').map(c => c.trim());
    if (cols.length !== 6 || cols[5] === 'Identifier' || cols[4] === 'local only') {
      continue;
    }
    const match = cols[5].match(/^(\d+\.\d+\.)(\d+)(.*)$/);
    if (!match || match.length !== 4) {
      continue;
    }

    const pattern = match[1].replace(/\./g, '\\.') + '[0-9][0-9]*' + match[3].replace(/\./g, '\\.');
    patchVersionReplacements[pattern] = match[0];
  }

  fixers[0].push({
    id: 'upgrade-sdkman-tools',
    cmd: `for dockerfile in \$(git ls-files | grep -i -E 'dockerfile\$'); do\n` +
      Object.keys(patchVersionReplacements).map(pattern => {
        return `  sed ${os.type() === 'Darwin' ? '-i "" -E' : '-i -e'} "s/\\(sdk install java \\)${pattern}/\\1${patchVersionReplacements[pattern]}/g" $dockerfile ;`;
      }).join('\n') +
      '\ndone',
    description: 'Update pinned sdkman tool versions',
  });
};

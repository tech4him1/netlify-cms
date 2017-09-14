import toml from 'toml-j0.4';
import tomlify from 'tomlify-j0.4';
import moment from 'moment';
import AssetProxy from '../valueObjects/AssetProxy';

const outputReplacer = (key, value) => {
  if (moment.isMoment(value)) {
    return value.format(value._f);
  }
  if (value instanceof AssetProxy) {
    return `${ value.path }`;
  }
  // Return `false` to use default (`undefined` would delete key).
  return false;
};

const sortKeys = (sortedKeys = []) => (a, b) => {
  const idxA = sortedKeys.indexOf(a);
  const idxB = sortedKeys.indexOf(b);
  if (idxA === -1 || idxB === -1) {
    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
  }

  if (idxA > idxB) return 1;
  if (idxA < idxB) return -1;
  return 0;
};

export default class TOML {
  constructor() {
    this.parse = this.fromFile;
    this.stringify = this.toFile;
  }
  
  fromFile(content) {
    return toml.parse(content);
  }

  toFile(data, { sortedKeys }) {
    return tomlify.toToml(data, { replace: outputReplacer, sort: sortKeys(sortedKeys) });
  }
}

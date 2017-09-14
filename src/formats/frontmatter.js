import matter from 'gray-matter';
import TOMLparser from './toml';
import YAMLparser from './yaml';
import JSONparser from './json';

const YAMLFormatter = new YAMLparser();
const TOMLFormatter = new TOMLparser();
const JSONFormatter = new JSONparser();

const parsers = {
  yaml: {
    parse: YAMLFormatter.fromFile.bind(YAMLFormatter),
    stringify: YAMLFormatter.toFile.bind(YAMLFormatter),
  },
  toml: {
    parse: TOMLFormatter.fromFile.bind(TOMLFormatter),
    stringify: TOMLFormatter.toFile.bind(TOMLFormatter),
  },
  json: {
    parse(contents) {
      let JSONinput = contents.trim();
      // Fix JSON if leading and trailing brackets were trimmed.
      if (JSONinput.substr(0, 1) !== '{') {
        JSONinput = '{' + JSONinput;
      }
      if (JSONinput.substr(-1) !== '}') {
        JSONinput = JSONinput + '}';
      }
      return JSONFormatter.fromFile(JSONinput);
    },
    stringify: JSONFormatter.toFile.bind(JSONFormatter),
  },
}

function inferFrontmatterFormat(str) {
  const firstLine = str.substr(0, str.indexOf('\n')).trim();
  if ((firstLine.length > 3) && (firstLine.substr(0, 3) === "---")) {
    // No need to infer, `gray-matter` will handle things like `---toml` for us.
    return;
  }
  switch (firstLine) {
    case "---":
      return { language: "yaml", delimiters: "---" };
    case "+++":
      return { language: "toml", delimiters: "+++" };
    case "{":
      return { language: "json", delimiters: ["{", "}"] };
    default:
      throw "Unrecgonized front-matter format.";
  }
}

export default class Frontmatter {
  fromFile(content) {
    const result = matter(content, { engines: parsers, ...inferFrontmatterFormat(content) });
    const data = result.data;
    data.body = result.content;
    return data;
  }

  toFile(data, sortedKeys) {
    const meta = {};
    let body = '';
    Object.keys(data).forEach((key) => {
      if (key === 'body') {
        body = data[key];
      } else {
        meta[key] = data[key];
      }
    });
    
    return matter.stringify(body, meta, { language: "yaml", delimiters: "---", engines: parsers, sortedKeys });
  }
}

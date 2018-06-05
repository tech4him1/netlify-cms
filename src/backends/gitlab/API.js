import LocalForage from "Lib/LocalForage";
import { Base64 } from "js-base64";
import { isString } from "lodash";
import AssetProxy from "ValueObjects/AssetProxy";
import { APIError } from "ValueObjects/errors";

export default class API {
  constructor(config) {
    this.api_root = config.api_root || "https://gitlab.com/api/v4";
    this.token = config.token || false;
    this.branch = config.branch || "master";
    this.repo = config.repo || "";
    this.repoURL = `/projects/${ encodeURIComponent(this.repo) }`;
  }

  user() {
    return this.request("/user");
  }

  hasWriteAccess(user) {
    const WRITE_ACCESS = 30;
    return this.request(this.repoURL).then(({ permissions }) => {
      const { project_access, group_access } = permissions;
      if (project_access && (project_access.access_level >= WRITE_ACCESS)) {
        return true;
      }
      if (group_access && (group_access.access_level >= WRITE_ACCESS)) {
        return true;
      }
      return false;
    });
  }

  requestHeaders(headers = {}) {
    return {
      ...headers,
      ...(this.token ? { Authorization: `Bearer ${ this.token }` } : {}),
    };
  }

  urlFor(path, options) {
    const cacheBuster = `ts=${ new Date().getTime() }`;
    const encodedParams = options.params
          ? Object.entries(options.params).map(
            ([key, val]) => `${ key }=${ encodeURIComponent(val) }`)
          : [];
    return `${ this.api_root }${ path }?${ [cacheBuster, ...encodedParams].join("&") }`;
  }

  request(path, options = {}, setCursor) {
    const headers = this.requestHeaders(options.headers || {});
    const url = this.urlFor(path, options);
    return fetch(url, { ...options, headers })
    .then((response) => {
      const contentType = response.headers.get("Content-Type");
      if (options.method === "HEAD" || options.method === "DELETE") {
        return Promise.all([response]);
      }
      if (options.responseType === "blob") {
        // TODO: GitLab always returns the blob with a mimetype of text/plain if Accept is set to raw.
        return Promise.all([response, response.blob()]);
      }
      if (contentType && contentType.match(/json/)) {
        return Promise.all([response, response.json()]);
      }
      return Promise.all([response, response.text()]);
    })
    .catch(err => Promise.reject([err, null]))
    .then(([response, value]) => {
      if (response.ok && setCursor) {
        const cursor = response.headers.get('X-Next-Page');
        setCursor(response.headers.get("X-Next-Page"));
      }
      if (response.ok) {
        return value;
      }
      return Promise.reject([value, response]);
    })
    .catch(([errorValue, response]) => {
      const errorMessageProp = (errorValue && errorValue.message) ? errorValue.message : null;
      const message = errorMessageProp || (isString(errorValue) ? errorValue : "");
      throw new APIError(message, response && response.status, 'GitLab', { response, errorValue });
    });
  }
  
  readFile(path, sha, { branch = this.branch, parseText = true } = {}) {
    const cacheKey = parseText ? `gh.${sha}` : `gh.${sha}.blob`;
    const cache = sha ? LocalForage.getItem(cacheKey) : Promise.resolve(null);
    return cache.then((cached) => {
      if (cached) { return cached; }
      
      return this.request(`${ this.repoURL }/repository/files/${ encodeURIComponent(path) }/raw`, {
        params: { ref: branch },
        cache: "no-store",
        responseType: (!parseText ? "blob" : "text"),
      })
      .then((result) => {
        if (sha) {
          LocalForage.setItem(cacheKey, result);
        }
        return result;
      });
    });
  }

  fileDownloadURL(path, branch = this.branch) {
      return this.urlFor(`${ this.repoURL }/repository/files/${ encodeURIComponent(path) }/raw`, {
        params: { ref: branch },
      });
  }

  listFiles(path, cursor, setCursor) {
    return this.request(`${ this.repoURL }/repository/tree`, {
      params: { path, ref: this.branch, page: cursor || 1 },
    }, setCursor)
    .then(files => files.filter(file => file.type === "blob"));
  }

  persistFiles(files, options) {
    const uploadOpts = {
      commitMessage: options.commitMessage,
      updateFile: (options.newEntry === false) || false,
    };

    const uploads = files.map(file => this.uploadAndCommit(file, uploadOpts));
    return Promise.all(uploads);
  }

  deleteFile(path, commit_message, options={}) {
    const branch = options.branch || this.branch;
    return this.request(`${ this.repoURL }/repository/files/${ encodeURIComponent(path) }`, {
      method: "DELETE",
      params: { commit_message, branch },
    });
  }

  toBase64(str) {
    return Promise.resolve(Base64.encode(str));
  }

  fromBase64(str) {
    return Base64.decode(str);
  }

  uploadAndCommit(item, {commitMessage, updateFile = false, branch = this.branch}) {
    const content = item instanceof AssetProxy ? item.toBase64() : this.toBase64(item.raw);
    // Remove leading slash from path if exists.
    const file_path = item.path.replace(/^\//, '');
    
    // We cannot use the `/repository/files/:file_path` format here because the file content has to go
    //   in the URI as a parameter. This overloads the OPTIONS pre-request (at least in Chrome 61 beta).
    return content.then(contentBase64 => this.request(`${ this.repoURL }/repository/commits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        branch,
        commit_message: commitMessage,
        actions: [{
          action: (updateFile ? "update" : "create"),
          file_path,
          content: contentBase64,
          encoding: "base64",
        }]
      }),
    })).then(response => Object.assign({}, item, { uploaded: true }));
  }
}

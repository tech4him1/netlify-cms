import trimStart from 'lodash/trimStart';
import semaphore from "semaphore";
import AuthenticationPage from "./AuthenticationPage";
import API from "./API";
import { fileExtension } from 'Lib/pathHelper';
import { EDITORIAL_WORKFLOW } from "Constants/publishModes";

const MAX_CONCURRENT_DOWNLOADS = 10;

export default class GitLab {
  constructor(config, proxied = false) {
    this.config = config;

    if (config.getIn(["publish_mode"]) === EDITORIAL_WORKFLOW) {
      throw new Error("The GitLab backend does not support the Editorial Workflow.")
    }

    if (!proxied && config.getIn(["backend", "repo"]) == null) {
      throw new Error("The GitLab backend needs a \"repo\" in the backend configuration.");
    }

    this.repo = config.getIn(["backend", "repo"], "");
    this.branch = config.getIn(["backend", "branch"], "master");
    this.api_root = config.getIn(["backend", "api_root"], "https://gitlab.com/api/v4");
    this.token = '';
  }

  authComponent() {
    return AuthenticationPage;
  }

  restoreUser(user) {
    return this.authenticate(user);
  }

  authenticate(state) {
    this.token = state.token;
    this.api = new API({ token: this.token, branch: this.branch, repo: this.repo, api_root: this.api_root });
    return this.api.user().then(user =>
      this.api.hasWriteAccess(user).then((isCollab) => {
        // Unauthorized user
        if (!isCollab) throw new Error("Your GitLab user account does not have access to this repo.");
        // Authorized user
        return Object.assign({}, user, { token: state.token });
      })
    );
  }

  logout() {
    this.token = null;
    return;
  }

  getToken() {
    return Promise.resolve(this.token);
  }

  entriesByFolder(collection, extension, cursor, setCursor) {
    return this.api.listFiles(collection.get("folder"), cursor, setCursor)
    .then(files => files.filter(file => fileExtension(file.name) === extension))
    .then(this.fetchFiles);
  }

  entriesByFiles(collection) {
    const files = collection.get("files").map(collectionFile => ({
      path: collectionFile.get("file"),
      label: collectionFile.get("label"),
    }));
    return this.fetchFiles(files);
  }

  fetchFiles = (files, apiOptions) => {
    const sem = semaphore(MAX_CONCURRENT_DOWNLOADS);
    const promises = [];
    files.forEach((file) => {
      promises.push(new Promise((resolve, reject) => (
        sem.take(() => this.api.readFile(file.path, file.id, apiOptions).then((data) => {
          resolve({ file, data });
          sem.leave();
        }).catch((err) => {
          sem.leave();
          reject(err);
        }))
      )));
    });
    return Promise.all(promises);
  };

  // Fetches a single entry.
  getEntry(collection, slug, path) {
    return this.api.readFile(path).then(data => ({
      file: { path },
      data,
    }));
  }

  getMedia(cursor, setCursor) {
    return this.api.listFiles(this.config.get('media_folder'), cursor, setCursor)
      .then(files => this.fetchFiles(files, { parseText: false }))
      .then(files => files.map(({ file: { id, name, path }, data }) => {
        const url = URL.createObjectURL(data);
        return { id, name, url, path };
      }));
  }


  async persistEntry(entry, options = {}) {
    return this.api.persistFiles([entry], options);
  }

  async persistMedia(mediaFile, options = {}) {
    await this.api.persistFiles([mediaFile], options);
    const { value, size, path, fileObj } = mediaFile;
    const url = this.api.fileDownloadURL(path);
    return { name: value, size: fileObj.size, url, path: trimStart(path, '/') };
  }

  deleteFile(path, commitMessage, options) {
    return this.api.deleteFile(path, commitMessage, options);
  }
}

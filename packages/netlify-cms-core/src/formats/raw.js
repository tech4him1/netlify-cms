export default {
  fromFile(content) {
    return { body: content };
  },

  toFile({ body = '' }) {
    return body;
  }
}

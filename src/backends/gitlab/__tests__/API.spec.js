import fetchMock from 'fetch-mock';
import { curry, escapeRegExp, isMatch, merge } from 'lodash';
import { Map } from 'immutable';

import API from '../API';

const compose = (...fns) => val => fns.reduceRight((newVal, fn) => fn(newVal), val);
const pipe = (...fns) => compose(...fns.reverse());

const regExpOrString = rOrS => (rOrS instanceof RegExp ? rOrS.toString() : escapeRegExp(rOrS));

const mockForAllParams = url => `${url}(\\?.*)?`;
const prependRoot = urlRoot => url => `${urlRoot}${url}`;
const matchWholeURL = str => `^${str}$`;
const strToRegex = str => new RegExp(str);
const matchURL = curry((urlRoot, forAllParams, url) => pipe(
  regExpOrString,
  ...(forAllParams ? [mockForAllParams] : []),
  pipe(regExpOrString, prependRoot)(urlRoot),
  matchWholeURL,
  strToRegex,
)(url));

// `mock` gives us a few advantages over using the standard
// `fetchMock.mock`:
//  - Routes can have a root specified that is prepended to the path 
//  - By default, routes swallow URL parameters (the GitHub API code
//    uses a `ts` parameter on _every_ request)
const mockRequest = curry((urlRoot, url, response, options={}) => {
  const mergedOptions = merge({}, {
    forAllParams: true,
    fetchMockOptions: {},
  }, options);
  return fetchMock.mock(
    matchURL(urlRoot, mergedOptions.forAllParams, url),
    response,
    options.fetchMockOptions,
  );
});

const defaultResponseHeaders = { "Content-Type": "application/json" };

afterEach(() => fetchMock.restore());

describe('gitlab API', () => {
  it('should correctly detect a contributor', () => {
    const api = new API({ branch: 'test-branch', repo: 'test-user/test-repo' });
    const user = { id: 1 };
    mockRequest(api.api_root)(`${ api.repoURL }/members/${ user.id }`, {
      headers: defaultResponseHeaders,
      body: {
        id: 1,
        access_level: 30,
      },
    });
    return expect(api.isCollaborator(user)).resolves.toBe(true);
  });
  
  it('should correctly detect a non-contributor', () => {
    const api = new API({ branch: 'test-branch', repo: 'test-user/test-repo' });
    const user = { id: 1 };
    mockRequest(api.api_root)(`${ api.repoURL }/members/${ user.id }`, {
      headers: defaultResponseHeaders,
      body: {
        id: 1,
        access_level: 10,
      },
    });
    return expect(api.isCollaborator(user)).resolves.toBe(false);
  });
  
  it('should list the files in a directory', () => {
    const api = new API({ branch: 'test-branch', repo: 'test-user/test-repo' });
    mockRequest(api.api_root)(`${ api.repoURL }/repository/tree`, {
      headers: defaultResponseHeaders,
      body: [
        {
          id: "fff6fe3a23bf1c8ea0692b4a883af99bee26fd3b",
          name: "octokit.rb",
          type: "blob",
          path: "test-directory/octokit.rb",
        },
        {
          id: "a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d",
          name: "octokit",
          type: "tree",
          path: "test-directory/octokit",
        },
      ],
    });
    return expect(api.listFiles('test-directory')).resolves.toMatchObject([
      {
        id: "fff6fe3a23bf1c8ea0692b4a883af99bee26fd3b",
        name: "octokit.rb",
        type: "blob",
        path: "test-directory/octokit.rb",
      },
    ]);
  });
});

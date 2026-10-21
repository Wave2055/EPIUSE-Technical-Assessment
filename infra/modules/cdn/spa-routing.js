// CloudFront viewer-request function on the SPA's default behaviour (ADR-0016). A path with
// no file extension is a client-side route such as /employees/123, so it is served the app
// shell; anything with an extension is a real asset and passes through.
//
// A path through a dot-segment (/.git/config, /.aws/credentials) is answered 404 here.
// Otherwise it has no extension, gets the app shell with a 200, and looks to a scanner
// like an exposed repository or credentials file (ADR-0034).
function handler(event) {
  var request = event.request;
  var segments = request.uri.split('/');
  for (var i = 0; i < segments.length; i++) {
    if (segments[i].charAt(0) === '.') {
      return { statusCode: 404, statusDescription: 'Not Found' };
    }
  }
  var lastSegment = segments[segments.length - 1];
  if (lastSegment.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}

// CloudFront viewer-request function on the SPA's default behaviour (ADR-0016). A path with
// no file extension is a client-side route such as /employees/123, so it is served the app
// shell; anything with an extension is a real asset and passes through.
function handler(event) {
  var request = event.request;
  var lastSegment = request.uri.split('/').pop();
  if (lastSegment.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}

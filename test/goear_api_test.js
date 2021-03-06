/*global describe:true, before:true, it:true */
var api = require('../lib/goear_api.js'),
    expect = require('chai').expect,
    util = require('util'),
    nock = require('nock'),
    request = require('request');

function filterTracks(tracks, quality) {
  return tracks.filter(function(t) {
    return quality <= t.quality;
  });
}


describe('GoEar API tests', function() {
  "use strict";

  describe('#search', function() {

    it("should return valid results", function(done) {
      api.search("David Guetta", function(err, data) {
        expect(err).to.be.null;
        expect(data).to.not.be.null;
        expect(data).to.be.an('object');
        expect(data).to.include.keys('tracks', 'totalCount');
        expect(data.tracks).to.be.a('array');
        expect(data.tracks).to.have.length.above(0);
        expect(data.totalCount).to.be.a('number');
        expect(data.tracks[0]).to.include.keys('id', 'title', 'quality', 'duration');
        done();
      });
    });

    it("should return valid content", function(done) {
      api.search("David Guetta - She Wolf", function(err, data) {
        expect(err).to.be.null;
        expect(data).to.exist;
        expect(data.tracks).to.have.length.above(0);
        expect(data.tracks[0]).to.include.keys('id', 'title', 'quality', 'duration');
        expect(data.tracks[0].title).to.match(/she wolf/i);
        done();
      });
    });

    it("should return a valid track URL", function(done) {
        var WARNING_TRACK_FILENAME = '32e73b9ea7a237a80f38b7e7bba97c54';

        api.search("David Guetta - She Wolf", function(err, data) {
            request({
                url: data.tracks[0].link,
                method: 'HEAD',
                followRedirect: false,
                headers: {
                    // Requests to track URLs must include a 'Referer' header
                    // If it is not provided, a default warning message track
                    // is returned instead the original one
                    'Referer': 'http://www.goear.com/'
                }
            }, function(err, resp, body) {
                expect([301, 302]).to.include(resp.statusCode);
                expect(resp.headers.location).to.not.have.string(WARNING_TRACK_FILENAME);
                done();
            });
        });
    });
    
    it("should return an empty result when searching for an unknown value", function(done) {
      api.search("123lkj123lkj", function(err, data) {
        expect(err).to.be.null;
        expect(data).to.not.be.null;
        expect(data.tracks).to.be.empty;
        expect(data.totalCount).to.equals(0);
        done();
      });
    });

    it("should return valid values when using default options", function(done) {
      api.search("The Police", function(err, data) {
        expect(data.tracks).to.have.length(10);
        expect(data.tracks[0]).to.include.keys('id', 'title', 'quality', 'duration', 'artist', 'link');
        var filteredTracks = filterTracks(data.tracks, 0);
        expect(filteredTracks).to.have.length(data.tracks.length);
        done();
      });
    });

    it("should respect minimum quality when specified in search options", function(done) {
      var minQuality = 192;
      api.search("U2", {
        minQuality: minQuality
      }, function(err, data) {
        expect(data.totalCount).to.not.exist;
        var filteredTracks = filterTracks(data.tracks, minQuality);
        expect(filteredTracks).to.have.length(data.tracks.length);
        done();
      });
    });

    it("should respect resultsCount when specified in search options", function(done) {
      var resultsCount = 50;
      api.search("Eric Clapton", {
        resultsCount: resultsCount
      }, function(err, data) {
        expect(data.tracks).to.have.length(resultsCount);
        done();
      });
    });

    it("should respect offset when specified in search options", function(done) {
      var searchTerm = "Genesis",
          offset = 2;
      api.search(searchTerm, {
        resultsCount: 20
      }, function(err, data) {
        expect(err).to.be.null;
        expect(data.tracks).to.have.length(20);
        api.search(searchTerm, {
          offset: offset,
          resultsCount: 10
        }, function(secondErr, secondData) {
          expect(secondErr).to.be.null;
          expect(data.tracks[0]).to.not.be.eql(secondData.tracks[0]);
          expect(data.tracks[10]).to.be.eql(secondData.tracks[0]);
          done();
        });
      });
    });

    it("should return extended info when specified in search options", function(done) {
      api.search("Seal", {
        extendedInfo: true
      }, function(err, data) {
      	var result = data.tracks.every(function(t) {
          return t.artist && t.link;
        });
        expect(result).to.be.true;
        done();
      });
    });
    
    it("Should return available results when looking for more results than api could return in a reasonable time", function(done) {
      var startTime = Date.now(),
          resultsCount = 100,
          finished = false;
      api.search("Genesis Jesus", {
        resultsCount: resultsCount,
        minQuality: 320,
        timeout: 2500
      }, function(err, data) {
        expect(err).to.be.null;
        expect(data.tracks).to.have.length.above(0);
        expect(data.tracks).to.have.length.below(resultsCount);
        expect(Date.now() - startTime).to.be.above(2500);
        finished = true;
        done();
      });
    });

    it("should handle error on next requests when pagination is needed", function(done) {
      var resultsCount = 50;

      nock('http://www.goear.com', { allowUnmocked: true })
        .get('/search/Eric%20Clapton/2')
        .reply(555);

      api.search("Eric Clapton", {
        resultsCount: resultsCount
      }, function(err, data) {
        expect(err).to.not.be.null;
        expect(err.message).to.equals('HTTP error code: 555');
        done();
      });
    });

    setTimeout(function(finished) {
      // Test should be running
      expect(finished).to.not.be.true;
    }, 3000);
  });

});

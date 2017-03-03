const path = require('path');
const APP_PATH = path.join(__dirname, '../');
const Article = require(path.join(APP_PATH, 'app/Article'));
const co = require('co')

describe('UnitTest Start .. ', function() {
	before(function() {

	});

	beforeEach(function() {
		article = new Article();
	});

	afterEach(function() {

	});

	after(function() {

	});

	describe('post', function() {
		it ('return true', function() {
			co(function* () {
			// yield	article.post("user:1", "a title", "a link");
			})
		});
	});

	describe('list', function() {
		it ('return true', function() {
			co(function* () {
				let rs = yield	article.list(1);
				console.log(rs);
			})
		});
	});


	describe('vote', function() {
		it ('return true', function() {
			co(function* () {
				yield	article.vote("user:3", "article:5");
			})
		});
	});

})

const redis = require('redis');
const Promise = require("bluebird");
const bluebird = require('bluebird');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

class Article {

	constructor() {
		//获取redis链接，默认ip:127.0.0.1 port:6379
		this.RedisClient = redis.createClient();

		//文章保存一周
		this.ONE_WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

		//一个赞增加的分数
		this.VOTE_SCORE = 432;

		//获取列表时，每一页25篇
		this.ARTICLE_PER_PAGE = 25;
	}

	/**
	 * 获取unix时间戳
	 * @return {[Int]} [unix时间戳]
	 */
	getTimestamp() {
		return ~~(new Date().getTime() / 1000);
	}

	/**
	 * [发布文章]
	 * @param  {[String]} user   [文章作者]
	 * @param  {[String]} title  [文章标题]
	 * @param  {[String]} link   [文章链接]
	 * @return {[Int]}        	 [文章id]
	 */
	* post(user, title, link) {

		//生成articleId
		let articleId = yield this.RedisClient.incrAsync('article:');

		let voted = `voted:${articleId}`;

		//将作者加入文章的赞同列表
		yield this.RedisClient.saddAsync(voted, user);

		//设置文章赞同列表生命周期
		yield this.RedisClient.expireAsync(voted, this.ONE_WEEK_IN_SECONDS);

		let now = this.getTimestamp();

		article = `article:${articleId}`;

		//保存文章
		yield this.RedisClient.hmsetAsync(article, {
			'title': title,
			'link': link,
			'poster': user,
			'time': now,
			'votes': 1
		})

		//初始化文章评分	
		yield this.RedisClient.zaddAsync('score:', (now + this.VOTE_SCORE), article);

		//初始化文章发布时间
		yield this.RedisClient.zaddAsync('time:', now, article);

		return articleId;
	}

	/**
	 * [获取文章列表]
	 * @param  {[Int]}      page   [列表分页]
	 * @param  {[String]}   order  [排序方式]
	 * @return {[Array]}            [文章组]
	 */
	* list(page, order = 'score:') {
		let start = (page - 1) * this.ARTICLE_PER_PAGE;
		let end = start + this.ARTICLE_PER_PAGE - 1;

		//根据order来获取已排序文章列表
		let ids = yield this.RedisClient.zrevrangeAsync(order, start, end);

		let articles = [];

		for (let i in ids) {
			var id = ids[i];

			//获取文章内容
			let article_data = yield this.RedisClient.hgetallAsync(id);

			article_data['id'] = id;
			articles.push(article_data);
		}

		return articles
	}

	/**
	 * [文章投票]
	 * @param  {[String]} user    [redis 用户标记]
	 * @param  {[String]} article [redis 文章标记]
	 */
	* vote(user, article) {
		let cutoff = this.getTimestamp() - this.ONE_WEEK_IN_SECONDS;

		let article_timestamp = yield this.RedisClient.zscoreAsync('time:', article);

		// 发布时间超过1周的不允许被点赞
		if (article_timestamp < cutoff) {
			return;
		}

		let articleId = this.getArticleIdByRedisName(article);

		// 判断该用户是否重复点赞
		let isMember = yield this.RedisClient.sismemberAsync(`voted:${articleId}`, user);

		// 已经点赞则不允许重复点赞
		if (isMember == 1) {
			return;
		}

		// 加入已评分集合
		yield this.RedisClient.saddAsync(`voted:${articleId}`, user);

		// 文章分数增加
		yield this.RedisClient.zincrbyAsync('score:', this.VOTE_SCORE, article);

		// 文章赞数增加
		yield this.RedisClient.hincrbyAsync(article, 'votes', 1);
	}

	* add_group(articleId, to_add = []) {
		let article = `article:${articleId}`;
		for (let i in to_add) {
			yield this.RedisClient.saddAsync(`group:${to_add[i]}`, article);
		}
	}

	* remove_group(articleId, to_remove = []) {
		let article = `article:${articleId}`;
		for (let i in to_remove) {
			yield this.RedisClient.sremAsync(`group:${to_remove[i]}`, article);
		}
	}

	/**
	 * [将文章redis key 转为数字id]
	 * @param  {[string]} article [reids key]
	 * @return {[int]}         		[文章id]
	 */
	getArticleIdByRedisName(article) {
		return article.split(":")[1];
	}
}

module.exports = Article;
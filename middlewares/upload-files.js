'use strict';
const util = require('util');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const createError = require('http-errors');
const {uploadFiles} = require('../configs');
const url = require('url');

async function upload (key, req, res, options) {
	const config = uploadFiles[key];
	let err;

	if(!config) {
		err = new createError.BadRequest('Key not valid');
		err.code = 'PARAMETERS_INVALID';
		throw err;
	}

	function _formatFiles (config, files) {
		const host = url.format({
			protocol: req.protocol,
			host: req.get('host'),
		});
		if(!files) {
			return [];
		}
		config.fields.forEach(item => {
			files[item.name].forEach(file => {
				file.link = `${host}/public/storage/${config.bucket}/${file.filename}`;
				delete file.path;
				delete file.destination;
			});
		});

		return files;
	}

	function _validateFileUpload (files, fields,  options = {
		fileIsRequired: true,
	}) {
		let err;
		fields.forEach((field) => {
			if (
				options.fileIsRequired &&
				(!files || !files[field.name] || !files[field.name].length)
			) {
				err = new createError.BadRequest('Missing file to upload!');
				err.code = 'MISSING_FILE';
				err.fields = field.name;
				throw err;
			}

			if (!options.fileIsRequired) {
				// Skipped if file is not required and dont has file upload
				if (!files || !files[field.name]) {
					return;
				}

				const file = files[field.name][0];
				if (file.size === 0) {
					// TODO: file still store in S3. need delete it
					err = new createError.BadRequest('Cannot upload 0 bytes file!');
					err.code = 'ZERO_SIZE_FILE';
					err.fields = field.name;
					throw err;
				}
			}
		});
	}

	const storage = multer.diskStorage({
		destination: function (req, file, cb) {
			const dest = path.join(path.resolve('./public/storage', config.bucket));
			if(!fs.existsSync(dest)){
				fs.mkdirSync(dest);
			}
			cb(null, dest);
		},
		filename: function (req, file, cb) {
			crypto.pseudoRandomBytes(16, function(err, raw) {
				cb(null, raw.toString('hex') + Date.now() + '.' + file.originalname);
			});
		}
	});

	const upload = multer({
		storage: storage,
		limits: {
			fileSize: config.maxFileSize,
		},
		fileFilter: (req, file, cb) => {
			if (
				config.allowedContentTypes &&
				!config.allowedContentTypes.includes(file.mimetype)
			) {
				const err = new createError.BadRequest(`Don't support mimetype ${file.mimetype}!`);
				err.code = 'MIMETYPE_INVALID';
				return cb(err);
			}
			cb(null, true);
		},
	});
	/* ~ upload file with util.promisify~ */
	const uploadCd = util.promisify(upload.fields(config.fields));
	await uploadCd(req, res);
	/* ~ handle files ~ */
	_validateFileUpload(req.files, config.fields, options);
	const files = _formatFiles(config, req.files);
	/* ~ ------- ~ */

	return files;
}

module.exports = {
	upload,
};
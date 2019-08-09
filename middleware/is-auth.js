module.exports = (req, res, next) => {
  if (!req.session.isLoggedIn) {
    req.flash('error', 'You need to Log in for that.');
    return res.redirect('/login');
  }
  next();
};

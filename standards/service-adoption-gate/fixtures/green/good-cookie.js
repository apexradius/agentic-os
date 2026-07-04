app.get("/login", (req, res) => {
  res.cookie("sid", req.session.id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
});

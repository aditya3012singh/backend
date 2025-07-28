export const isTechnician = (req, res, next) => {
  if (req.user.role !== "TECHNICIAN") {
    return res.status(403).json({ message: "Only technicians allowed" });
  }
  next();
};

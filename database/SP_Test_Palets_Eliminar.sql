-- Stored Procedure para eliminar un palet
CREATE PROCEDURE [dbo].[SP_Test_Palets_Eliminar]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Primero eliminar la composición del palet
    DELETE FROM PaletComposicion WHERE PaletId = @Id;
    
    -- Luego eliminar el palet
    DELETE FROM Palets WHERE Id = @Id;
    
    -- Devolver success
    SELECT 1 as Result;
END
